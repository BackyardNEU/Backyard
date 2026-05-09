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

  // Throwing in an async route handler is safe in Express 5 — it gets piped to
  // the error middleware in server/index.js. We attach .status so the handler
  // can respond with the right HTTP code instead of a generic 500.
  if (error) {
    const err = new Error(error.message);
    err.status = 502; // we got a response from Supabase, but it was an error
    throw err;
  }

  res.json(data);
});

export default router;
