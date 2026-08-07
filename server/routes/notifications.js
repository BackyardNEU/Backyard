import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getBlockedIds, filterBlocked } from '../lib/blocks.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { data: notifs, error } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('recipient_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  // Drop anything a blocked user did. Notifications outlive the action that created
  // them, so without this a block would leave their name sitting in the tray.
  const blockedIds = await getBlockedIds(req.user.id);
  const visible = filterBlocked(notifs, blockedIds, (n) => n.actor_id);

  const actorIds = [...new Set(visible.filter((n) => n.actor_id).map((n) => n.actor_id))];
  let actorMap = {};
  if (actorIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', actorIds);
    actorMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  }

  const enriched = visible.map((n) => ({
    ...n,
    actor: n.actor_id ? (actorMap[n.actor_id] ?? null) : null,
  }));

  res.json(enriched);
});

// Must be defined before /:id to avoid Express matching 'read-all-visible' as an id param
router.post('/read-all-visible', async (req, res) => {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', req.user.id)
    .is('read_at', null);

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.status(204).end();
});

router.patch('/:id', async (req, res) => {
  const { read_at, action_taken } = req.body || {};
  const updates = {};
  if (read_at !== undefined) updates.read_at = read_at;
  if (action_taken !== undefined) updates.action_taken = action_taken;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'nothing to update' });
  }

  const { error } = await supabaseAdmin
    .from('notifications')
    .update(updates)
    .eq('id', req.params.id)
    .eq('recipient_id', req.user.id);

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.status(204).end();
});

export default router;
