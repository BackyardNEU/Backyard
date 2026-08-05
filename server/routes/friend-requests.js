import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { NotificationService } from '../notifications/service.js';

const router = express.Router();
router.use(requireAuth);

// Send a friend request
router.post('/', async (req, res) => {
  const { recipientId } = req.body || {};
  if (!recipientId) return res.status(400).json({ error: 'recipientId required' });
  if (recipientId === req.user.id) return res.status(400).json({ error: 'cannot send a request to yourself' });

  const { data: request, error } = await supabaseAdmin
    .from('friend_requests')
    .insert({ sender_id: req.user.id, recipient_id: recipientId, status: 'pending' })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'request already exists' });
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  await NotificationService.dispatch({
    type: 'friend_request',
    recipientId,
    actorId: req.user.id,
    entity: { kind: 'friend_request', id: request.id },
  });

  res.status(201).json({ id: request.id });
});

// Accept or decline a request (recipient only)
router.patch('/:id', async (req, res) => {
  const { status } = req.body || {};
  if (!['accepted', 'declined'].includes(status)) {
    return res.status(400).json({ error: 'status must be accepted or declined' });
  }

  const { data: request, error: fetchError } = await supabaseAdmin
    .from('friend_requests')
    .select('id, sender_id, recipient_id')
    .eq('id', req.params.id)
    .eq('recipient_id', req.user.id)
    .eq('status', 'pending')
    .single();

  if (fetchError || !request) return res.status(404).json({ error: 'request not found' });

  await supabaseAdmin
    .from('friend_requests')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('id', request.id);

  if (status === 'accepted') {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, friend_list')
      .in('id', [request.sender_id, request.recipient_id]);

    const sender = profiles.find((p) => p.id === request.sender_id);
    const recipient = profiles.find((p) => p.id === request.recipient_id);

    await supabaseAdmin
      .from('profiles')
      .update({ friend_list: [...new Set([...(sender.friend_list || []), request.recipient_id])] })
      .eq('id', request.sender_id);

    await supabaseAdmin
      .from('profiles')
      .update({ friend_list: [...new Set([...(recipient.friend_list || []), request.sender_id])] })
      .eq('id', request.recipient_id);

    await NotificationService.dispatch({
      type: 'friend_accepted',
      recipientId: request.sender_id,
      actorId: request.recipient_id,
      entity: { kind: 'friend_request', id: request.id },
    });
  }

  res.status(204).end();
});

// Cancel a pending request (sender only)
router.delete('/:id', async (req, res) => {
  const { error } = await supabaseAdmin
    .from('friend_requests')
    .delete()
    .eq('id', req.params.id)
    .eq('sender_id', req.user.id)
    .eq('status', 'pending');

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.status(204).end();
});

export default router;
