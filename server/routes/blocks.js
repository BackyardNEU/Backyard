import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { isUuid } from '../lib/blocks.js';

const router = express.Router();

router.use(requireAuth);

/**
 * Removes each user from the other's friend_list.
 *
 * Deliberately not reusing DELETE /api/me/friends/:friendId — that route only strips the
 * friend from the *caller's* list, leaving the other side still holding the caller as a
 * friend. For an unfriend that asymmetry is merely untidy; for a block it would mean the
 * blocked person still sees the blocker in their friends list.
 */
async function severFriendship(a, b) {
  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('id, friend_list')
    .in('id', [a, b]);

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  for (const profile of profiles || []) {
    const other = profile.id === a ? b : a;
    const current = profile.friend_list || [];
    const next = current.filter((id) => id !== other);
    if (next.length === current.length) continue; // not friends; nothing to write

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ friend_list: next })
      .eq('id', profile.id);

    if (updateError) {
      const err = new Error(updateError.message);
      err.status = 502;
      throw err;
    }
  }
}

// GET /api/me/blocks — the people you have blocked, for a management screen.
// Only your own blocks; there is deliberately no way to see who has blocked you.
router.get('/', async (req, res) => {
  const { data: blocks, error } = await supabaseAdmin
    .from('user_blocks')
    .select('blocked_id, created_at')
    .eq('blocker_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  const ids = (blocks || []).map((b) => b.blocked_id);
  if (ids.length === 0) return res.json([]);

  const { data: profiles, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', ids);

  if (profileError) {
    const err = new Error(profileError.message);
    err.status = 502;
    throw err;
  }

  // The .order() above applies to the user_blocks query, but the response is built from
  // the profiles result, whose .in() ordering is not guaranteed — so sort explicitly
  // rather than relying on it. Newest block first.
  const blockedAt = new Map((blocks || []).map((b) => [b.blocked_id, b.created_at]));
  res.json(
    (profiles || [])
      .map((p) => ({ ...p, blocked_at: blockedAt.get(p.id) ?? null }))
      .sort((a, b) => new Date(b.blocked_at ?? 0) - new Date(a.blocked_at ?? 0))
  );
});

// POST /api/me/blocks  { blockedId }
// Blocks a user and severs the relationship. Idempotent.
router.post('/', async (req, res) => {
  const blockedId = req.body?.blockedId;

  if (!isUuid(blockedId)) {
    return res.status(400).json({ error: 'blockedId must be a valid user id' });
  }
  if (blockedId === req.user.id) {
    return res.status(400).json({ error: 'You cannot block yourself' });
  }

  const { data: target, error: targetError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', blockedId)
    .maybeSingle();

  if (targetError) {
    const err = new Error(targetError.message);
    err.status = 502;
    throw err;
  }
  if (!target) return res.status(404).json({ error: 'User not found' });

  const { error: insertError } = await supabaseAdmin
    .from('user_blocks')
    .upsert(
      { blocker_id: req.user.id, blocked_id: blockedId },
      { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true }
    );

  if (insertError) {
    const err = new Error(insertError.message);
    err.status = 502;
    throw err;
  }

  await severFriendship(req.user.id, blockedId);

  // Drop any pending request in either direction, so blocking someone with an
  // outstanding request does not leave it sitting in their tray.
  const { error: requestError } = await supabaseAdmin
    .from('friend_requests')
    .delete()
    .or(
      `and(sender_id.eq.${req.user.id},recipient_id.eq.${blockedId}),` +
      `and(sender_id.eq.${blockedId},recipient_id.eq.${req.user.id})`
    );

  if (requestError) {
    const err = new Error(requestError.message);
    err.status = 502;
    throw err;
  }

  res.status(204).end();
});

// DELETE /api/me/blocks/:blockedId — unblock. Does not restore the friendship.
router.delete('/:blockedId', async (req, res) => {
  const { blockedId } = req.params;

  if (!isUuid(blockedId)) {
    return res.status(400).json({ error: 'blockedId must be a valid user id' });
  }

  const { error } = await supabaseAdmin
    .from('user_blocks')
    .delete()
    .eq('blocker_id', req.user.id)
    .eq('blocked_id', blockedId);

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.status(204).end();
});

export default router;
