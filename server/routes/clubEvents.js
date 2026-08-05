import express from 'express';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

// Optional auth — attaches req.user if a valid Bearer token is present, otherwise no-ops.
function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token && JWT_SECRET) {
    try {
      const payload = jwt.verify(token, JWT_SECRET, { audience: 'authenticated' });
      req.user = { id: payload.sub };
    } catch { /* ignore invalid/expired tokens */ }
  }
  next();
}

// GET /api/clubs/:clubId/events/monthly?year=2026&month=6
// Returns events spanning prev month, current month, and next month for the given club.
// Optional auth — members also see members-only events.
router.get('/:clubId/events/monthly', optionalAuth, async (req, res) => {
  const { clubId } = req.params;
  const year = parseInt(req.query.year, 10);
  const month = parseInt(req.query.month, 10);

  if (!year || !month || month < 1 || month > 12) {
    return res.status(400).json({ error: 'Valid year and month (1–12) are required' });
  }

  let isMember = false;
  if (req.user) {
    const { data: membership } = await supabaseAdmin
      .from('club_memberships')
      .select('role')
      .eq('user_id', req.user.id)
      .eq('club_id', clubId)
      .maybeSingle();
    isMember = !!membership;
  }

  const { data, error } = await supabaseAdmin
    .rpc('get_club_monthly_events', {
      p_club_id: clubId,
      p_year: year,
      p_month: month,
      p_is_member: isMember,
    });

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.json(data || []);
});

// GET /api/clubs/:clubId/events
// Public, optional auth. Returns this week's events for the given club.
// Authenticated members also see events where is_members_only = true.
router.get('/:clubId/events', optionalAuth, async (req, res) => {
  const { clubId } = req.params;

  const now = new Date();
  const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  let isMember = false;
  if (req.user) {
    const { data: membership } = await supabaseAdmin
      .from('club_memberships')
      .select('role')
      .eq('user_id', req.user.id)
      .eq('club_id', clubId)
      .maybeSingle();
    isMember = !!membership;
  }

  let query = supabaseAdmin
    .from('club_events')
    .select('*')
    .eq('id_of_club', clubId)
    .gte('start_time', now.toISOString())
    .lte('start_time', weekOut.toISOString())
    .order('start_time', { ascending: true });

  if (!isMember) {
    query = query.or('is_members_only.is.null,is_members_only.eq.false');
  }

  const { data, error } = await query;

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.json(data || []);
});

// GET /api/clubs/:clubId/events/rsvps?eventIds=a,b,c
// Returns all RSVPs for the given event IDs (used for friend callouts).
router.get('/:clubId/events/rsvps', async (req, res) => {
  const idsParam = req.query.eventIds;
  if (!idsParam) return res.json([]);

  const ids = String(idsParam).split(',').filter(Boolean);
  if (ids.length === 0) return res.json([]);

  const { data, error } = await supabaseAdmin
    .from('attendees')
    .select('user_id, event_id')
    .in('event_id', ids);

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.json(data || []);
});

// POST /api/clubs/:clubId/events/:eventId/rsvp — auth required
router.post('/:clubId/events/:eventId/rsvp', requireAuth, async (req, res) => {
  const { error } = await supabaseAdmin
    .from('attendees')
    .upsert(
      { user_id: req.user.id, event_id: req.params.eventId },
      { onConflict: 'user_id,event_id', ignoreDuplicates: true }
    );

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.status(204).end();
});

// DELETE /api/clubs/:clubId/events/:eventId/rsvp — auth required
router.delete('/:clubId/events/:eventId/rsvp', requireAuth, async (req, res) => {
  const { error } = await supabaseAdmin
    .from('attendees')
    .delete()
    .eq('user_id', req.user.id)
    .eq('event_id', req.params.eventId);

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.status(204).end();
});

export default router;
