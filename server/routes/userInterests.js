import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

router.use(requireAuth);

// GET /api/me/interests
// Returns the current user's selected interests.
// Shape: [{ category_id, subcategory_ids: uuid[] }, ...]
router.get('/', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('user_interests')
    .select('category_id, subcategory_ids')
    .eq('user_id', req.user.id);

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.json(data || []);
});

// PUT /api/me/interests
// Replaces the user's full interest selection.
// Body: { interests: [{ category_id, subcategory_ids: uuid[] }, ...] }
// Limits: max 3 categories, max 3 subcategories per category.
router.put('/', async (req, res) => {
  const { interests } = req.body || {};

  if (!Array.isArray(interests)) {
    return res.status(400).json({ error: 'interests must be an array' });
  }
  if (interests.length > 3) {
    return res.status(400).json({ error: 'Maximum 3 categories allowed' });
  }

  for (const item of interests) {
    if (!item.category_id) {
      return res.status(400).json({ error: 'Each entry must have a category_id' });
    }
    if (!Array.isArray(item.subcategory_ids)) {
      return res.status(400).json({ error: 'subcategory_ids must be an array' });
    }
    if (item.subcategory_ids.length > 3) {
      return res.status(400).json({ error: 'Maximum 3 subcategories per category' });
    }
  }

  // Delete all existing rows for this user then re-insert — simpler than diffing.
  const { error: delError } = await supabaseAdmin
    .from('user_interests')
    .delete()
    .eq('user_id', req.user.id);

  if (delError) {
    const err = new Error(delError.message);
    err.status = 502;
    throw err;
  }

  if (interests.length > 0) {
    const rows = interests.map(item => ({
      user_id: req.user.id,
      category_id: item.category_id,
      subcategory_ids: item.subcategory_ids,
    }));

    const { error: insertError } = await supabaseAdmin
      .from('user_interests')
      .insert(rows);

    if (insertError) {
      const err = new Error(insertError.message);
      err.status = 502;
      throw err;
    }
  }

  res.status(204).end();
});

export default router;
