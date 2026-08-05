import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

// GET /:clubId/members — public
// Returns full roster sorted top_moderator → moderator → member.
// Includes user_id so clients can identify the current user's row.
router.get('/:clubId/members', async (req, res) => {
  const { clubId } = req.params;

  const { data, error } = await supabaseAdmin
    .from('club_memberships')
    .select(`
      user_id,
      role,
      custom_role_id,
      club_custom_roles ( name, grants_moderator_privileges ),
      profiles ( username, avatar_url )
    `)
    .eq('club_id', clubId)
    .order('role');

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.json(data || []);
});

// POST /:clubId/members/me — join (auth required)
// School-match guard enforced here; RLS is defense-in-depth.
// Dual-writes profiles.member_list for backward compat.
router.post('/:clubId/members/me', requireAuth, async (req, res) => {
  const { clubId } = req.params;
  const userId = req.user.id;

  const [{ data: userProfile }, { data: club }] = await Promise.all([
    supabaseAdmin.from('profiles').select('school, member_list').eq('id', userId).single(),
    supabaseAdmin.from('demo_club_data').select('school').eq('id', clubId).single(),
  ]);

  if (!userProfile?.school || userProfile.school !== club?.school) {
    return res.status(403).json({ error: 'You can only join clubs at your own school.' });
  }

  const { data: existing } = await supabaseAdmin
    .from('club_memberships')
    .select('user_id')
    .eq('user_id', userId)
    .eq('club_id', clubId)
    .maybeSingle();

  if (existing) return res.status(409).json({ error: 'Already a member of this club.' });

  const { error: insertError } = await supabaseAdmin
    .from('club_memberships')
    .insert({ user_id: userId, club_id: clubId, role: 'member' });

  if (insertError) {
    const err = new Error(insertError.message);
    err.status = 502;
    throw err;
  }

  // Dual-write
  const currentList = userProfile?.member_list || [];
  if (!currentList.includes(clubId)) {
    await supabaseAdmin
      .from('profiles')
      .update({ member_list: [...currentList, clubId] })
      .eq('id', userId);
  }

  res.status(201).json({ role: 'member' });
});

// DELETE /:clubId/members/me — leave (auth required)
// top_moderator must transfer ownership first.
// Dual-writes profiles.member_list for backward compat.
router.delete('/:clubId/members/me', requireAuth, async (req, res) => {
  const { clubId } = req.params;
  const userId = req.user.id;

  const [{ data: membership }, { data: profile }] = await Promise.all([
    supabaseAdmin
      .from('club_memberships')
      .select('role')
      .eq('user_id', userId)
      .eq('club_id', clubId)
      .maybeSingle(),
    supabaseAdmin
      .from('profiles')
      .select('member_list')
      .eq('id', userId)
      .single(),
  ]);

  if (!membership) return res.status(404).json({ error: 'Not a member of this club.' });
  if (membership.role === 'top_moderator') {
    return res.status(403).json({ error: 'Transfer ownership before leaving the club.' });
  }

  const { error: deleteError } = await supabaseAdmin
    .from('club_memberships')
    .delete()
    .eq('user_id', userId)
    .eq('club_id', clubId);

  if (deleteError) {
    const err = new Error(deleteError.message);
    err.status = 502;
    throw err;
  }

  // Dual-write
  const newList = (profile?.member_list || []).filter((id) => id !== clubId);
  await supabaseAdmin.from('profiles').update({ member_list: newList }).eq('id', userId);

  res.status(204).end();
});

// POST /:clubId/members/transfer-ownership — top_moderator only
// Atomically promotes newTopModeratorId, demotes self to moderator.
router.post('/:clubId/members/transfer-ownership', requireAuth, async (req, res) => {
  const { clubId } = req.params;
  const { newTopModeratorId } = req.body;

  if (!newTopModeratorId) {
    return res.status(400).json({ error: 'newTopModeratorId is required.' });
  }

  const [{ data: myMembership }, { data: targetMembership }] = await Promise.all([
    supabaseAdmin
      .from('club_memberships')
      .select('role')
      .eq('user_id', req.user.id)
      .eq('club_id', clubId)
      .maybeSingle(),
    supabaseAdmin
      .from('club_memberships')
      .select('role')
      .eq('user_id', newTopModeratorId)
      .eq('club_id', clubId)
      .maybeSingle(),
  ]);

  if (myMembership?.role !== 'top_moderator') {
    return res.status(403).json({ error: 'Only the top moderator can transfer ownership.' });
  }
  if (!targetMembership) {
    return res.status(404).json({ error: 'Target user is not a member of this club.' });
  }

  const [promoteResult, demoteResult] = await Promise.all([
    supabaseAdmin
      .from('club_memberships')
      .update({ role: 'top_moderator' })
      .eq('user_id', newTopModeratorId)
      .eq('club_id', clubId),
    supabaseAdmin
      .from('club_memberships')
      .update({ role: 'moderator' })
      .eq('user_id', req.user.id)
      .eq('club_id', clubId),
  ]);

  if (promoteResult.error || demoteResult.error) {
    const err = new Error('Failed to transfer ownership.');
    err.status = 502;
    throw err;
  }

  res.json({ ok: true });
});

// PATCH /:clubId/members/:userId/role — promote to moderator or demote to member
// top_moderator only; cannot target another top_moderator or set top_moderator via this endpoint.
router.patch('/:clubId/members/:userId/role', requireAuth, async (req, res) => {
  const { clubId, userId } = req.params;
  const { role } = req.body;

  if (!['moderator', 'member'].includes(role)) {
    return res.status(400).json({ error: 'Role must be "moderator" or "member".' });
  }

  const [{ data: myMembership }, { data: targetMembership }] = await Promise.all([
    supabaseAdmin
      .from('club_memberships')
      .select('role')
      .eq('user_id', req.user.id)
      .eq('club_id', clubId)
      .maybeSingle(),
    supabaseAdmin
      .from('club_memberships')
      .select('role')
      .eq('user_id', userId)
      .eq('club_id', clubId)
      .maybeSingle(),
  ]);

  if (myMembership?.role !== 'top_moderator') {
    return res.status(403).json({ error: 'Only the top moderator can promote or demote members.' });
  }
  if (!targetMembership) {
    return res.status(404).json({ error: 'User is not a member of this club.' });
  }
  if (targetMembership.role === 'top_moderator') {
    return res.status(403).json({ error: 'Cannot change the role of the top moderator.' });
  }

  const { error: updateError } = await supabaseAdmin
    .from('club_memberships')
    .update({ role })
    .eq('user_id', userId)
    .eq('club_id', clubId);

  if (updateError) {
    const err = new Error(updateError.message);
    err.status = 502;
    throw err;
  }

  res.json({ ok: true });
});

export default router;
