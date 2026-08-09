import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';

const router = express.Router();

// GET /api/interests
// Returns the full taxonomy: all categories with their subcategories nested.
// Public — no auth required.
router.get('/', async (req, res) => {
  const [catRes, subRes] = await Promise.allSettled([
    supabaseAdmin.from('interest_categories').select('id, name').order('name'),
    supabaseAdmin.from('interest_subcategories').select('id, category_id, name').order('name'),
  ]);

  if (catRes.status === 'rejected' || catRes.value.error) {
    const err = new Error(catRes.value?.error?.message || catRes.reason?.message);
    err.status = 502;
    throw err;
  }
  if (subRes.status === 'rejected' || subRes.value.error) {
    const err = new Error(subRes.value?.error?.message || subRes.reason?.message);
    err.status = 502;
    throw err;
  }

  const categories = catRes.value.data || [];
  const subcategories = subRes.value.data || [];

  // Nest subcategories under their parent category
  const subMap = new Map();
  for (const sub of subcategories) {
    if (!subMap.has(sub.category_id)) subMap.set(sub.category_id, []);
    subMap.get(sub.category_id).push({ id: sub.id, name: sub.name });
  }

  const taxonomy = categories.map(cat => ({
    id: cat.id,
    name: cat.name,
    subcategories: subMap.get(cat.id) || [],
  }));

  res.set('Cache-Control', 'public, max-age=300');
  res.json(taxonomy);
});

export default router;
