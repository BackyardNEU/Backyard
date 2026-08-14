import express from 'express';
import rateLimit from 'express-rate-limit';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60 });

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

// POST /api/interests/subcategories
// Authenticated. Creates a new subcategory under a given category.
// If a subcategory with the same name (case-insensitive) already exists under that
// category, returns the existing row — safe to call on every "Add" click.
router.post('/subcategories', writeLimiter, requireAuth, async (req, res) => {
  const { category_id, name } = req.body || {};

  if (!category_id) return res.status(400).json({ error: 'category_id is required' });

  const trimmedName = (name || '').trim();
  if (trimmedName.length < 2) {
    return res.status(400).json({ error: 'Subcategory name must be at least 2 characters' });
  }
  if (trimmedName.length > 50) {
    return res.status(400).json({ error: 'Subcategory name must be 50 characters or fewer' });
  }

  // Validate the category exists
  const { data: cat, error: catError } = await supabaseAdmin
    .from('interest_categories')
    .select('id')
    .eq('id', category_id)
    .maybeSingle();

  if (catError) { const err = new Error(catError.message); err.status = 502; throw err; }
  if (!cat) return res.status(400).json({ error: 'Category not found' });

  // Return the existing row if the name is already taken (case-insensitive)
  const { data: existing } = await supabaseAdmin
    .from('interest_subcategories')
    .select('id, name, category_id')
    .eq('category_id', category_id)
    .ilike('name', trimmedName)
    .maybeSingle();

  if (existing) return res.json(existing);

  const { data, error } = await supabaseAdmin
    .from('interest_subcategories')
    .insert({ category_id, name: trimmedName })
    .select('id, name, category_id')
    .single();

  if (error) { const err = new Error(error.message); err.status = 502; throw err; }

  res.status(201).json(data);
});

export default router;
