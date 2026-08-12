import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireModerator, requireTopModerator } from '../lib/clubPermissions.js';

const router = express.Router();

// Same palette StatsModule.jsx uses for stat bars — kept in sync manually
// since there's no shared constants module between client and server.
const ROLE_COLORS = [
  '#724200ff', '#56758b', '#be2419ff', '#da781cff',
  '#ffcc13', '#628753ff', '#a39a96', '#d3d1c9ff',
];

// GET /:clubId/members — public
// Returns full roster sorted top_moderator → moderator → member.
// Two-step query: club_memberships.user_id references auth.users, not profiles,
// so PostgREST can't resolve the profiles join automatically.
router.get('/:clubId/members', async (req, res) => {
  const { clubId } = req.params;

  const { data: memberships, error: mError } = await supabaseAdmin
    .from('club_memberships')
    .select('user_id, role, custom_role_id, club_custom_roles ( name, grants_moderator_privileges, role_color )')
    .eq('club_id', clubId)
    .order('role');

  if (mError) {
    const err = new Error(mError.message);
    err.status = 502;
    throw err;
  }

  if (!memberships?.length) return res.json([]);

  const userIds = memberships.map((m) => m.user_id);
  const { data: profiles, error: pError } = await supabaseAdmin
    .from('profiles')
    // first/last name feed Avatar's initials fallback for members with no photo
    .select('id, username, avatar_url, first_name, last_name')
    .in('id', userIds);

  if (pError) {
    const err = new Error(pError.message);
    err.status = 502;
    throw err;
  }

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
  const result = memberships.map((m) => ({
    ...m,
    profiles: profileMap.get(m.user_id) ?? null,
  }));

  res.json(result);
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

  const role = 'member';

  const { error: insertError } = await supabaseAdmin
    .from('club_memberships')
    .insert({ user_id: userId, club_id: clubId, role });

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

  res.status(201).json({ role });
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

// ─── Custom roles ────────────────────────────────────────────────────────────

// GET /:clubId/roles — public
router.get('/:clubId/roles', async (req, res) => {
  const { clubId } = req.params;

  const { data, error } = await supabaseAdmin
    .from('club_custom_roles')
    .select('id, name, grants_moderator_privileges, role_color, created_at')
    .eq('club_id', clubId)
    .order('created_at');

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.json(data || []);
});

// POST /:clubId/roles — create a custom role
// Non-privileged: any moderator or owner. Privileged: owner only.
// 409 if name already exists for this club.
router.post('/:clubId/roles', requireAuth, async (req, res) => {
  const { clubId } = req.params;
  const { name, grants_moderator_privileges = false, role_color } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ error: 'Role name is required.' });
  }

  if (role_color && !ROLE_COLORS.includes(role_color)) {
    return res.status(400).json({ error: 'Invalid role color.' });
  }

  if (grants_moderator_privileges) {
    await requireTopModerator(req.user.id, clubId);
  } else {
    await requireModerator(req.user.id, clubId);
  }

  const { data, error } = await supabaseAdmin
    .from('club_custom_roles')
    .insert({
      club_id: clubId,
      name: name.trim(),
      grants_moderator_privileges,
      role_color: role_color || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A role with that name already exists for this club.' });
    }
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.status(201).json(data);
});

// DELETE /:clubId/roles/:roleId — delete a custom role
// Privileged roles: owner only. Non-privileged: any moderator or owner.
// ON DELETE SET NULL removes the label from members without changing their mechanical role.
router.delete('/:clubId/roles/:roleId', requireAuth, async (req, res) => {
  const { clubId, roleId } = req.params;

  const { data: customRole, error: lookupError } = await supabaseAdmin
    .from('club_custom_roles')
    .select('grants_moderator_privileges')
    .eq('id', roleId)
    .eq('club_id', clubId)
    .maybeSingle();

  if (lookupError) {
    const err = new Error(lookupError.message);
    err.status = 502;
    throw err;
  }
  if (!customRole) return res.status(404).json({ error: 'Custom role not found.' });

  if (customRole.grants_moderator_privileges) {
    await requireTopModerator(req.user.id, clubId);
  } else {
    await requireModerator(req.user.id, clubId);
  }

  const { error: deleteError } = await supabaseAdmin
    .from('club_custom_roles')
    .delete()
    .eq('id', roleId);

  if (deleteError) {
    const err = new Error(deleteError.message);
    err.status = 502;
    throw err;
  }

  res.status(204).end();
});

// PATCH /:clubId/members/:userId — assign or remove a custom role label
// Body: { customRoleId: uuid | null }
// Assigning a privileged custom role also elevates the member's mechanical role to 'moderator'.
router.patch('/:clubId/members/:userId', requireAuth, async (req, res) => {
  const { clubId, userId } = req.params;
  const { customRoleId } = req.body;

  if (customRoleId === undefined) {
    return res.status(400).json({ error: 'customRoleId is required (uuid or null).' });
  }

  if (customRoleId === null) {
    // Removing custom role label — any moderator can do this
    await requireModerator(req.user.id, clubId);

    const { error } = await supabaseAdmin
      .from('club_memberships')
      .update({ custom_role_id: null })
      .eq('user_id', userId)
      .eq('club_id', clubId);

    if (error) {
      const err = new Error(error.message);
      err.status = 502;
      throw err;
    }
    return res.json({ ok: true });
  }

  // Assigning a custom role — check privilege level
  const { data: customRole, error: roleError } = await supabaseAdmin
    .from('club_custom_roles')
    .select('grants_moderator_privileges')
    .eq('id', customRoleId)
    .eq('club_id', clubId)
    .maybeSingle();

  if (roleError) {
    const err = new Error(roleError.message);
    err.status = 502;
    throw err;
  }
  if (!customRole) return res.status(404).json({ error: 'Custom role not found.' });

  if (customRole.grants_moderator_privileges) {
    await requireTopModerator(req.user.id, clubId);
    // Atomically set label and elevate mechanical role
    const { error } = await supabaseAdmin
      .from('club_memberships')
      .update({ custom_role_id: customRoleId, role: 'moderator' })
      .eq('user_id', userId)
      .eq('club_id', clubId);

    if (error) {
      const err = new Error(error.message);
      err.status = 502;
      throw err;
    }
  } else {
    await requireModerator(req.user.id, clubId);
    const { error } = await supabaseAdmin
      .from('club_memberships')
      .update({ custom_role_id: customRoleId })
      .eq('user_id', userId)
      .eq('club_id', clubId);

    if (error) {
      const err = new Error(error.message);
      err.status = 502;
      throw err;
    }
  }

  res.json({ ok: true });
});

export default router;
