import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const { q, school } = req.query;

  const { data, error } = await supabaseAdmin
    .rpc('search_clubs', {
      search_query: q,
      filter_school: school,
    });

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.json(data);
});


export default router;
