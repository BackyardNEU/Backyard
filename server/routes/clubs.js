import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';

const router = express.Router();

// GET /api/clubs — list all clubs.
// Public: no requireAuth middleware. The service-role client just runs the query
// against Supabase as if RLS didn't exist, which is fine here because the data
// is meant to be public anyway.
router.get('/', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('demo_club_data')
    .select('*');


  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.json(data);
});

router.get('/:clubId/reviews', async (req, res) => {
  const { clubId } = req.params;

  const { data, error } = await supabaseAdmin
    .from('reviews')
    .select('*')
    .eq('club_id', clubId);

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.json(data);
});

router.get('/review-tags', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('reviews')
    .select('club_id, review_tags');

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.json(data);
});

router.get('/:clubId/review-tags', async (req, res) => {
  const { clubId } = req.params;

  const { data, error } = await supabaseAdmin
    .from('reviews')
    .select('review_tags')
    .eq('club_id', clubId);

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.json(data);
});

router.get('/:clubId/stats', async (req, res) => {
  const { clubId } = req.params;

  const { data, error } = await supabaseAdmin
    .rpc('get_averages', { p_club_id: clubId });

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.json(data);
});

export default router;
