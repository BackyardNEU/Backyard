import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// REQUIRED SUPABASE SETUP (create these before these routes will work)
//
// 1. Table: club_page_data
//    club_id    uuid  PRIMARY KEY  REFERENCES demo_club_data(id)
//    modules    jsonb NOT NULL DEFAULT '[]'
//      Shape: [{ type: string, order: int, data: object }, ...]
//      Example row:
//        { "type": "basic_info", "order": 0,
//          "data": { "club_name": "...", "logo_url": "...", "description": "..." } }
//    updated_at timestamptz DEFAULT now()
//
// 2. Table: approved_club_accounts
//    user_id  uuid  REFERENCES auth.users(id)
//    club_id  uuid  REFERENCES demo_club_data(id)
//    PRIMARY KEY (user_id, club_id)
//    Rows are inserted manually (or via an admin UI) per approved account.
//
// 3. SQL RPC function: get_top_tags(p_club_id uuid, p_limit int DEFAULT 3)
//    Suggested body:
//      SELECT tag, count(*)::int AS cnt
//      FROM reviews, unnest(review_tags) AS tag
//      WHERE club_id = p_club_id
//      GROUP BY tag ORDER BY cnt DESC LIMIT p_limit;
//    Returns: [{ tag: text, cnt: int }, ...]
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/clubs/:clubId/page
// Public. Returns the club_page_data row (modules preset) for this club.
// Returns null if the club hasn't configured their page yet.
router.get('/:clubId/page', async (req, res) => {
  const { clubId } = req.params;

  const { data, error } = await supabaseAdmin
    .from('club_page_data')
    .select('*')
    .eq('club_id', clubId)
    .maybeSingle();

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.json(data); // null if no row yet — ClubPage falls back to demo_club_data
});

// PUT /api/clubs/:clubId/page
// Authenticated. Approved club account only.
// Upserts the modules array for this club's page.
router.put('/:clubId/page', requireAuth, async (req, res) => {
  const { clubId } = req.params;
  const { modules } = req.body;

  if (!Array.isArray(modules)) {
    return res.status(400).json({ error: 'modules must be an array' });
  }

  // Verify the authenticated user is an approved account for this club.
  const { data: approval, error: approvalError } = await supabaseAdmin
    .from('approved_club_accounts')
    .select('user_id')
    .eq('user_id', req.user.id)
    .eq('club_id', clubId)
    .maybeSingle();

  if (approvalError) {
    const err = new Error(approvalError.message);
    err.status = 502;
    throw err;
  }

  if (!approval) {
    return res.status(403).json({ error: 'Not an approved account for this club' });
  }

  const { data, error } = await supabaseAdmin
    .from('club_page_data')
    .upsert(
      { club_id: clubId, modules, updated_at: new Date().toISOString() },
      { onConflict: 'club_id' }
    )
    .select()
    .single();

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.json(data);
});

// GET /api/clubs/:clubId/top-tags
// Public. Calls the get_top_tags RPC to return the top 3 review tags for a club.
// Returns [] if the RPC function doesn't exist yet.
router.get('/:clubId/top-tags', async (req, res) => {
  const { clubId } = req.params;

  // Requires SQL RPC: get_top_tags(p_club_id uuid, p_limit int DEFAULT 3)
  const { data, error } = await supabaseAdmin
    .rpc('get_top_tags', { p_club_id: clubId, p_limit: 3 });

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.json(data ?? []); // [{ tag: string, cnt: int }, ...]
});

// GET /api/clubs/:clubId/is-approved
// Authenticated. Returns { approved: bool } for the current user + club.
router.get('/:clubId/is-approved', requireAuth, async (req, res) => {
  const { clubId } = req.params;

  // Requires the approved_club_accounts table described above.
  const { data, error } = await supabaseAdmin
    .from('approved_club_accounts')
    .select('user_id')
    .eq('user_id', req.user.id)
    .eq('club_id', clubId)
    .maybeSingle();

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.json({ approved: !!data });
});

export default router;
