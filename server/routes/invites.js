import express from 'express';
import crypto from 'crypto';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

async function isApprovedFor(userId, clubId) {
  const { data, error } = await supabaseAdmin
    .from('approved_club_accounts')
    .select('user_id')
    .eq('user_id', userId)
    .eq('club_id', clubId)
    .maybeSingle();
  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }
  return !!data;
}

// POST /api/clubs/:clubId/invite-link — approved editors only
router.post('/clubs/:clubId/invite-link', requireAuth, async (req, res) => {
  const { clubId } = req.params;
  if (!(await isApprovedFor(req.user.id, clubId))) {
    return res.status(403).json({ error: 'Not an approved account for this club' });
  }

  const token = crypto.randomBytes(32).toString('hex');

  const { data, error } = await supabaseAdmin
    .from('club_invite_links')
    .insert({ token, club_id: clubId, created_by: req.user.id })
    .select('id, expires_at')
    .single();

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  const origin = process.env.FRONTEND_URL || 'http://localhost:5173';
  res.status(201).json({
    url: `${origin}/join/${token}`,
    token,
    expires_at: data.expires_at,
    id: data.id,
  });
});

// GET /api/invite/:token — public, returns club info for the landing page
router.get('/invite/:token', async (req, res) => {
  const { token } = req.params;

  const { data, error } = await supabaseAdmin
    .from('club_invite_links')
    .select('id, club_id, expires_at, use_count, max_uses, is_revoked, demo_club_data(club_name, image_url)')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }
  if (!data) return res.status(404).json({ error: 'Invite link not found' });
  if (data.is_revoked) return res.status(410).json({ error: 'This invite link has been revoked' });
  if (new Date(data.expires_at) < new Date()) return res.status(410).json({ error: 'This invite link has expired' });
  if (data.max_uses !== null && data.use_count >= data.max_uses) {
    return res.status(410).json({ error: 'This invite link has reached its maximum uses' });
  }

  res.json({
    club_id: data.club_id,
    club_name: data.demo_club_data?.club_name,
    club_image: data.demo_club_data?.image_url,
    expires_at: data.expires_at,
  });
});

// POST /api/invite/:token/redeem — authenticated, add club to user's member_list
router.post('/invite/:token/redeem', requireAuth, async (req, res) => {
  const { token } = req.params;

  const { data: invite, error: inviteError } = await supabaseAdmin
    .from('club_invite_links')
    .select('id, club_id, expires_at, use_count, max_uses, is_revoked')
    .eq('token', token)
    .maybeSingle();

  if (inviteError) {
    const err = new Error(inviteError.message);
    err.status = 502;
    throw err;
  }
  if (!invite) return res.status(404).json({ error: 'Invite link not found' });
  if (invite.is_revoked) return res.status(410).json({ error: 'This invite link has been revoked' });
  if (new Date(invite.expires_at) < new Date()) return res.status(410).json({ error: 'This invite link has expired' });
  if (invite.max_uses !== null && invite.use_count >= invite.max_uses) {
    return res.status(410).json({ error: 'This invite link has reached its maximum uses' });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('member_list')
    .eq('id', req.user.id)
    .single();

  if (profileError) {
    const err = new Error(profileError.message);
    err.status = 502;
    throw err;
  }

  const currentList = profile?.member_list || [];
  if (currentList.includes(invite.club_id)) {
    return res.json({ already_member: true, club_id: invite.club_id });
  }

  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ member_list: [...currentList, invite.club_id] })
    .eq('id', req.user.id);

  if (updateError) {
    const err = new Error(updateError.message);
    err.status = 502;
    throw err;
  }

  await supabaseAdmin
    .from('club_invite_links')
    .update({ use_count: invite.use_count + 1 })
    .eq('id', invite.id);

  res.json({ joined: true, club_id: invite.club_id });
});

// PATCH /api/invite/:token/revoke — approved editors only
router.patch('/invite/:token/revoke', requireAuth, async (req, res) => {
  const { token } = req.params;

  const { data: invite, error: fetchError } = await supabaseAdmin
    .from('club_invite_links')
    .select('id, club_id')
    .eq('token', token)
    .maybeSingle();

  if (fetchError) {
    const err = new Error(fetchError.message);
    err.status = 502;
    throw err;
  }
  if (!invite) return res.status(404).json({ error: 'Invite link not found' });
  if (!(await isApprovedFor(req.user.id, invite.club_id))) {
    return res.status(403).json({ error: 'Not an approved account for this club' });
  }

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
