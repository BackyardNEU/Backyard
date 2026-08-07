import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { checkMuted } from '../middleware/checkMuted.js';
import textModerator from '../lib/textModerator.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// REQUIRED SUPABASE SETUP (create before these routes will work)
//
// Table: user_faqs   (questions users submit to a club's FAQ module)
//   id         uuid        PRIMARY KEY DEFAULT gen_random_uuid()
//   club_id    uuid        NOT NULL REFERENCES demo_club_data(id)
//   user_id    uuid        NOT NULL REFERENCES auth.users(id)
//   question   text        NOT NULL
//   created_at timestamptz DEFAULT now()
//   UNIQUE (user_id, club_id)   -- enforces "one question per club per user"
//
// Accepting a question is handled client-side + the existing PUT /clubs/:id/page:
// the editor appends the Q&A to the faqs module draft and the row is removed via
// DELETE below on Save. There is intentionally no server-side "accept" endpoint.
// ─────────────────────────────────────────────────────────────────────────────

// All FAQ-question routes require a logged-in user.
//
// Scoped to this router's own path rather than a bare router.use(requireAuth): this
// router shares the /api/clubs mount with clubsRouter, clubPageRouter, clubMembersRouter
// and clubEventsRouter, and it is mounted ahead of clubEventsRouter. A blanket
// router.use() therefore ran for *every* /api/clubs request and 401'd anonymous callers
// before clubEventsRouter was ever reached — which silently turned all of that router's
// optionalAuth event routes into authenticated-only ones.
router.use('/:clubId/questions', requireAuth);

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

// POST /api/clubs/:clubId/questions
// Submit a question. One per club per user (DB unique constraint → 409 on repeat).
router.post('/:clubId/questions', checkMuted, async (req, res) => {
  const { clubId } = req.params;
  const question = (req.body?.question || '').trim();
  if (!question) return res.status(400).json({ error: 'question required' });

  const textCheck = textModerator.check(question);
  if (!textCheck.clean) {
    return res.status(400).json({ error: textCheck.message });
  }

  const { data, error } = await supabaseAdmin
    .from('user_faqs')
    .insert({ club_id: clubId, user_id: req.user.id, question })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'You already asked a question for this club' });
    }
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.status(201).json(data);
});

// GET /api/clubs/:clubId/questions/mine
// The caller's own question for this club (or null) — drives the ask card's "sent" state.
router.get('/:clubId/questions/mine', async (req, res) => {
  const { clubId } = req.params;

  const { data, error } = await supabaseAdmin
    .from('user_faqs')
    .select('id, question, created_at')
    .eq('club_id', clubId)
    .eq('user_id', req.user.id)
    .maybeSingle();

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.json(data); // null if none
});

// GET /api/clubs/:clubId/questions
// Approved editors only. Pending questions for the club (count = length).
router.get('/:clubId/questions', async (req, res) => {
  const { clubId } = req.params;
  if (!(await isApprovedFor(req.user.id, clubId))) {
    return res.status(403).json({ error: 'Not an approved account for this club' });
  }

  const { data, error } = await supabaseAdmin
    .from('user_faqs')
    .select('id, question, user_id, created_at')
    .eq('club_id', clubId)
    .order('created_at', { ascending: true });

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.json(data ?? []);
});

// DELETE /api/clubs/:clubId/questions/:qid
// Approved editors only. Removes a row — used on Save for both accepted and deleted questions.
router.delete('/:clubId/questions/:qid', async (req, res) => {
  const { clubId, qid } = req.params;
  if (!(await isApprovedFor(req.user.id, clubId))) {
    return res.status(403).json({ error: 'Not an approved account for this club' });
  }

  const { error } = await supabaseAdmin
    .from('user_faqs')
    .delete()
    .eq('id', qid)
    .eq('club_id', clubId);

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.status(204).end();
});

export default router;
