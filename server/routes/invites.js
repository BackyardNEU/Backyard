import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { isAdmin } from '../lib/isAdmin.js';
import { inviteUrl } from '../lib/appUrls.js';
import { mintToken, hashToken, tokenPrefix } from '../lib/inviteTokens.js';
import { grantClubRole, hasTopModerator } from '../lib/clubMembership.js';
import { requireModerator } from '../lib/clubPermissions.js';

const router = express.Router();

// A NULL expires_at means "never expires". The previous check compared
// new Date(null) — the 1970 epoch — so member links, whose insert never set the
// column, all read as permanently expired.
function isUsable(link) {
  if (link.is_revoked) return false;
  if (link.expires_at && new Date(link.expires_at) <= new Date()) return false;
  if (link.max_uses !== null && link.use_count >= link.max_uses) return false;
  return true;
}

// GET /api/admin/is-admin — quick check; returns 200 if admin, 403 if not
router.get('/admin/is-admin', requireAuth, (req, res) => {
  if (!isAdmin(req.user.id)) return res.status(403).json({ error: 'Not an admin' });
  res.json({ isAdmin: true });
});

// POST /api/admin/clubs/:clubId/editor-invite-link — admin only, grants edit permissions on redeem
router.post('/admin/clubs/:clubId/editor-invite-link', requireAuth, async (req, res) => {
  if (!isAdmin(req.user.id)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const { clubId } = req.params;
  const { max_uses = 1, days_valid = 7 } = req.body;

  const token = mintToken();
  const expires_at = new Date(Date.now() + days_valid * 24 * 60 * 60 * 1000).toISOString();

  // Plaintext is returned to the caller once and never stored.
  const { data, error } = await supabaseAdmin
    .from('club_invite_links')
    .insert({
      token_hash: hashToken(token),
      token_prefix: tokenPrefix(token),
      club_id: clubId,
      created_by: req.user.id,
      max_uses,
      expires_at,
      link_type: 'editor',
    })
    .select('id, expires_at')
    .single();

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.status(201).json({
    url: inviteUrl(token),
    token,
    expires_at: data.expires_at,
    id: data.id,
  });
});

// POST /api/clubs/:clubId/invite-link — club moderators only.
// Was gated on approved_club_accounts, the legacy table; club_memberships.role is what
// every other club-write path checks.
router.post('/clubs/:clubId/invite-link', requireAuth, async (req, res) => {
  const { clubId } = req.params;
  await requireModerator(req.user.id, clubId);

  const token = mintToken();

  const { data, error } = await supabaseAdmin
    .from('club_invite_links')
    .insert({
      token_hash: hashToken(token),
      token_prefix: tokenPrefix(token),
      club_id: clubId,
      created_by: req.user.id,
    })
    .select('id, expires_at')
    .single();

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.status(201).json({
    url: inviteUrl(token),
    token,
    expires_at: data.expires_at,
    id: data.id,
  });
});

// GET /api/invite/:token — public, returns club info for the landing page.
//
// Deliberately withholds demo_club_data.email: that column holds scraped contact
// addresses and this endpoint needs no authentication.
router.get('/invite/:token', async (req, res) => {
  const { token } = req.params;

  const { data, error } = await supabaseAdmin
    .from('club_invite_links')
    .select('id, club_id, expires_at, use_count, max_uses, is_revoked, link_type, demo_club_data(club_name, image_url, school)')
    .eq('token_hash', hashToken(token))
    .maybeSingle();

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }
  if (!data) return res.status(404).json({ error: 'Invite link not found' });

  // Revoked, expired and exhausted collapse into one message so the response cannot be
  // used to probe which links exist and in what state.
  if (!isUsable(data)) {
    return res.status(410).json({ error: 'This invite link is no longer valid' });
  }

  res.json({
    club_id: data.club_id,
    club_name: data.demo_club_data?.club_name,
    club_image: data.demo_club_data?.image_url,
    club_school: data.demo_club_data?.school,
    expires_at: data.expires_at,
    link_type: data.link_type,
  });
});

// POST /api/invite/:token/redeem — authenticated.
//
// Editor and onboarding links previously wrote only approved_club_accounts, but
// clubPage.js gates page editing on club_memberships.role. A club leader who redeemed
// an editor link got a permission row the editor never reads, then a 403 on their
// first save. Both tables are written now: club_memberships because it is what the
// page routes check, approved_club_accounts because the interests routes still read it.
router.post('/invite/:token/redeem', requireAuth, async (req, res) => {
  const { token } = req.params;

  // Atomic: SELECT ... FOR UPDATE inside the function serialises concurrent redeems,
  // and club_invite_redemptions makes a repeat redeem by the same user free. Returns
  // no rows for unknown/revoked/expired/exhausted alike.
  const { data: consumed, error: consumeError } = await supabaseAdmin
    .rpc('consume_invite_link', {
      p_token_hash: hashToken(token),
      p_user_id: req.user.id,
    });

  if (consumeError) {
    const err = new Error(consumeError.message);
    err.status = 502;
    throw err;
  }

  const link = Array.isArray(consumed) ? consumed[0] : consumed;
  if (!link) {
    return res.status(410).json({ error: 'This invite link is no longer valid' });
  }

  const grantsEditing = link.link_type === 'editor' || link.link_type === 'onboarding';

  if (!grantsEditing) {
    const { role } = await grantClubRole(req.user.id, link.club_id, 'member');
    return res.json({ joined: true, club_id: link.club_id, role, is_editor: false });
  }

  // An invite must never displace a club's existing owner, so a second redeemer lands
  // as moderator rather than taking top_moderator away from whoever holds it.
  const targetRole = (await hasTopModerator(link.club_id)) ? 'moderator' : 'top_moderator';
  const { role } = await grantClubRole(req.user.id, link.club_id, targetRole);

  const { error: approvalError } = await supabaseAdmin
    .from('approved_club_accounts')
    .insert({ user_id: req.user.id, club_id: link.club_id });
  if (approvalError && approvalError.code !== '23505') {
    const err = new Error(approvalError.message);
    err.status = 502;
    throw err;
  }

  if (link.link_type === 'onboarding') {
    // Conditional on status so a race cannot re-claim a club someone already claimed.
    await supabaseAdmin
      .from('club_onboarding')
      .update({
        status: 'claimed',
        claimed_by: req.user.id,
        claimed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('club_id', link.club_id)
      .eq('status', 'unclaimed');
  }

  res.json({
    joined: true,
    club_id: link.club_id,
    role,
    is_editor: true,
    onboarding: link.link_type === 'onboarding',
    first_use: link.first_use,
  });
});


// PATCH /api/invite/:token/revoke — club moderators only
router.patch('/invite/:token/revoke', requireAuth, async (req, res) => {
  const { token } = req.params;

  const { data: invite, error: fetchError } = await supabaseAdmin
    .from('club_invite_links')
    .select('id, club_id')
    .eq('token_hash', hashToken(token))
    .maybeSingle();

  if (fetchError) {
    const err = new Error(fetchError.message);
    err.status = 502;
    throw err;
  }
  if (!invite) return res.status(404).json({ error: 'Invite link not found' });
  await requireModerator(req.user.id, invite.club_id);

  const { error } = await supabaseAdmin
    .from('club_invite_links')
    .update({ is_revoked: true })
    .eq('id', invite.id);

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.status(204).end();
});

export default router;
