import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

const VALID_CATEGORIES = ['bug_report', 'general', 'account'];

// POST /api/support/tickets — create a new ticket
router.post('/tickets', requireAuth, async (req, res) => {
  const { category, subject, description } = req.body;

  if (!category || !subject || !description) {
    return res.status(400).json({ error: 'category, subject, and description are required' });
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }
  if (typeof subject !== 'string' || subject.trim().length === 0) {
    return res.status(400).json({ error: 'Subject cannot be empty' });
  }
  if (subject.length > 120) {
    return res.status(400).json({ error: 'Subject must be 120 characters or fewer' });
  }
  if (description.length > 2000) {
    return res.status(400).json({ error: 'Description must be 2000 characters or fewer' });
  }

  // Generate ticket ID from total count so IDs are always ascending and unique.
  const { count, error: countError } = await supabaseAdmin
    .from('support_tickets')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    const err = new Error(countError.message);
    err.status = 502;
    throw err;
  }

  const ticketId = `BYD-${String((count || 0) + 1).padStart(4, '0')}`;

  const { data, error } = await supabaseAdmin
    .from('support_tickets')
    .insert({
      ticket_id: ticketId,
      user_id: req.user.id,
      category,
      subject: subject.trim(),
      description: description.trim(),
    })
    .select('ticket_id, category, subject, status, created_at')
    .single();

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.status(201).json(data);
});

// GET /api/support/tickets — fetch the logged-in user's tickets
router.get('/tickets', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('support_tickets')
    .select('ticket_id, category, subject, status, created_at')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.json(data);
});

export default router;
