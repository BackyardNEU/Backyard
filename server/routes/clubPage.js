import express from 'express';
import rateLimit from 'express-rate-limit';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { checkMuted } from '../middleware/checkMuted.js';
import textModerator from '../lib/textModerator.js';

const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60 });

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// REQUIRED SUPABASE SETUP (create these before these routes will work)
//
// 1. Table: club_page_data
//    club_id    uuid  PRIMARY KEY  REFERENCES demo_club_data(id)
//    modules    jsonb NOT NULL DEFAULT '[]'
//      Shape: [{ type: string, order: int, isDisplayed: bool, data: object }, ...]
//      Example row:
//        { "type": "basic_info", "order": 0, "isDisplayed": true,
//          "data": { "club_name": "...", "logo_url": "...", "description": "..." } }
//    updated_at timestamptz DEFAULT now()
//
// 2. Table: approved_club_accounts
//    user_id  uuid  REFERENCES auth.users(id)
//    club_id  uuid  REFERENCES demo_club_data(id)
//    PRIMARY KEY (user_id, club_id)
//    Rows are inserted manually (or via an admin UI) per approved account.
//
// ─────────────────────────────────────────────────────────────────────────────

import { DEFAULT_MODULES } from '../../shared/clubPageDefaults.js';
import { validateModules } from '../../shared/clubPageValidation.js';
import { sanitizeModules } from '../../shared/sanitizeModules.js';

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

// POST /api/clubs/:clubId/page/init
// Authenticated. Approved club account only.
// If the club has no page data yet, writes the default modules template (substituting
// the club's real name/logo/description into basic_info) and returns the new row.
// If data already exists, returns it unchanged — this is a safe no-op on repeat calls.
router.post('/:clubId/page/init', requireAuth, async (req, res) => {
  const { clubId } = req.params;

  // Verify moderator or top_moderator role
  const { data: membership, error: approvalError } = await supabaseAdmin
    .from('club_memberships')
    .select('role')
    .eq('user_id', req.user.id)
    .eq('club_id', clubId)
    .maybeSingle();

  if (approvalError) {
    const err = new Error(approvalError.message);
    err.status = 502;
    throw err;
  }
  if (!membership || !['top_moderator', 'moderator'].includes(membership.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Check for existing data
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('club_page_data')
    .select('*')
    .eq('club_id', clubId)
    .maybeSingle();

  if (existingError) {
    const err = new Error(existingError.message);
    err.status = 502;
    throw err;
  }

  // Already has modules — return without overwriting
  if (existing?.modules?.length > 0) {
    return res.json(existing);
  }

  // Fetch the club's real info to substitute into basic_info
  const { data: clubRow } = await supabaseAdmin
    .from('demo_club_data')
    .select('club_name, image_url, club_description')
    .eq('id', clubId)
    .maybeSingle();

  const modules = DEFAULT_MODULES.map(m => {
    if (m.type !== 'basic_info') return m;
    return {
      ...m,
      data: {
        ...m.data,
        ...(clubRow?.club_name    ? { club_name:    clubRow.club_name }    : {}),
        ...(clubRow?.image_url    ? { logo_url:     clubRow.image_url }    : {}),
        ...(clubRow?.club_description ? { description: clubRow.club_description } : {}),
      },
    };
  });

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

  res.status(201).json(data);
});

function extractModuleText(modules) {
  const texts = {};
  let i = 0;
  const add = (prefix, value) => { if (value) texts[`${prefix}_${i++}`] = value; };
  for (const mod of modules) {
    const d = mod.data || {};
    if (mod.type === 'basic_info') {
      add('club_name', d.club_name);
      add('description', d.description);
    } else if (mod.type === 'join') {
      for (const tab of d.tabs || []) {
        add('tab_title', tab.title);
        add('tab_body', tab.body);
      }
    } else if (mod.type === 'faqs') {
      for (const faq of d.faqs || []) {
        add('faq_q', faq.q);
        add('faq_a', faq.a);
      }
    } else if (mod.type === 'member_roster') {
      for (const m of d.members || []) {
        add('member_name', m.name);
        add('member_bio', m.bio);
      }
    } else if (mod.type === 'club_media') {
      for (const p of d.posters || []) {
        add('poster_text', p.poster_text);
        for (const c of p.content || []) {
          add('poster_content', c.value);
        }
      }
    } else if (mod.type === 'stats') {
      for (const s of d.stats || []) {
        add('stat_label', s.label);
        add('stat_unit', s.unit1);
      }
    }
  }
  return texts;
}

// PUT /api/clubs/:clubId/page
// Authenticated. Approved club account only.
// Upserts the modules array for this club's page.
router.put('/:clubId/page', requireAuth, checkMuted, async (req, res) => {
  const { clubId } = req.params;
  const { modules } = req.body;

  if (!Array.isArray(modules)) {
    return res.status(400).json({ error: 'modules must be an array' });
  }

  // Structural validation used to be client-only (ExpandedTile.jsx), so calling this
  // endpoint directly bypassed every length cap, URL check and count limit.
  const structure = validateModules(modules);
  if (!structure.valid) {
    return res.status(400).json({
      error: structure.errors[0].message,
      field: structure.errors[0].module,
      errors: structure.errors,
    });
  }

  const moduleTexts = extractModuleText(modules);
  const textCheck = textModerator.checkFields(moduleTexts);
  if (!textCheck.clean) {
    return res.status(400).json({ error: textCheck.message, field: textCheck.field });
  }

  // Strip anything but formatting tags from the two rich-text fields before storing.
  // Client-side sanitizing is UX; this is the layer curl cannot skip.
  const safeModules = sanitizeModules(modules);

  // Verify moderator or top_moderator role.
  const { data: membership, error: approvalError } = await supabaseAdmin
    .from('club_memberships')
    .select('role')
    .eq('user_id', req.user.id)
    .eq('club_id', clubId)
    .maybeSingle();

  if (approvalError) {
    const err = new Error(approvalError.message);
    err.status = 502;
    throw err;
  }

  if (!membership || !['top_moderator', 'moderator'].includes(membership.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Redeeming an onboarding invite grants top_moderator — which is exactly the role this
  // endpoint checks. Without this gate a club sent through outreach could skip the wizard
  // and PUT straight to their public page, publishing unreviewed content and defeating
  // the entire point of staging drafts in club_onboarding.
  //
  // Only clubs actually in the outreach pipeline have a row here, so clubs that never
  // went through it are unaffected.
  const { data: onboarding } = await supabaseAdmin
    .from('club_onboarding')
    .select('status')
    .eq('club_id', clubId)
    .maybeSingle();

  if (onboarding && onboarding.status !== 'approved') {
    return res.status(409).json({
      error: 'Your page is still being set up. Finish it at your club setup link — we publish it once it has been reviewed.',
      status: onboarding.status,
    });
  }

  const { data, error } = await supabaseAdmin
    .from('club_page_data')
    .upsert(
      { club_id: clubId, modules: safeModules, updated_at: new Date().toISOString() },
      { onConflict: 'club_id' }
    )
    .select()
    .single();

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  // Sync club_name and image_url back to demo_club_data so the main club listing
  // reflects edits made in the page editor.
  const basicInfo = safeModules.find(m => m.type === 'basic_info')?.data;
  if (basicInfo) {
    const syncFields = {};
    if (basicInfo.club_name?.trim()) syncFields.club_name = basicInfo.club_name.trim();
    if (basicInfo.logo_url) syncFields.image_url = basicInfo.logo_url;
    if (Object.keys(syncFields).length) {
      await supabaseAdmin.from('demo_club_data').update(syncFields).eq('id', clubId);
    }
  }

  res.json(data);
});


// GET /api/clubs/:clubId/is-approved
// Authenticated. Returns { approved: bool } for the current user + club.
router.get('/:clubId/is-approved', requireAuth, async (req, res) => {
  const { clubId } = req.params;

  const { data, error } = await supabaseAdmin
    .from('club_memberships')
    .select('role')
    .eq('user_id', req.user.id)
    .eq('club_id', clubId)
    .maybeSingle();

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  const role = data?.role ?? null;

  // Non-members may be waiting on approval. The membership button cannot render a
  // "Requested" state without this, and the club page already fetches this endpoint,
  // so folding it in here avoids a second round trip on every card open.
  let joinRequestPending = false;
  if (!role) {
    const { data: pending } = await supabaseAdmin
      .from('club_join_requests')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('club_id', clubId)
      .eq('status', 'pending')
      .maybeSingle();
    joinRequestPending = Boolean(pending);
  }

  res.json({
    approved: ['top_moderator', 'moderator'].includes(role),
    role,
    joinRequestPending,
  });
});

// GET /api/clubs/:clubId/interests
// Public. Returns the club's assigned category and subcategories, or null if none set.
router.get('/:clubId/interests', async (req, res) => {
  const { clubId } = req.params;

  const { data, error } = await supabaseAdmin
    .from('club_interests')
    .select('category_id, subcategory_ids')
    .eq('club_id', clubId)
    .maybeSingle();

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.json(data || null);
});

// PUT /api/clubs/:clubId/interests
// Approved club accounts only. Upserts the club's category + subcategories.
// Body: { category_id: uuid, subcategory_ids: uuid[] }  (max 2 subcategories)
router.put('/:clubId/interests', writeLimiter, requireAuth, async (req, res) => {
  const { clubId } = req.params;
  const { category_id, subcategory_ids } = req.body || {};

  // Verify the requesting user is an approved account for this club
  const { data: approved, error: approvedError } = await supabaseAdmin
    .from('approved_club_accounts')
    .select('user_id')
    .eq('user_id', req.user.id)
    .eq('club_id', clubId)
    .maybeSingle();

  if (approvedError) {
    const err = new Error(approvedError.message);
    err.status = 502;
    throw err;
  }
  if (!approved) {
    return res.status(403).json({ error: 'Not authorized for this club' });
  }

  if (!category_id) {
    return res.status(400).json({ error: 'category_id is required' });
  }
  if (!Array.isArray(subcategory_ids)) {
    return res.status(400).json({ error: 'subcategory_ids must be an array' });
  }
  if (subcategory_ids.length > 2) {
    return res.status(400).json({ error: 'Maximum 2 subcategories allowed' });
  }

  // Validate that every subcategory ID actually belongs to the claimed category.
  if (subcategory_ids.length > 0) {
    const { data: validSubs, error: subError } = await supabaseAdmin
      .from('interest_subcategories')
      .select('id, category_id')
      .in('id', subcategory_ids);

    if (subError) {
      const err = new Error(subError.message);
      err.status = 502;
      throw err;
    }

    const subCatMap = new Map((validSubs || []).map(s => [s.id, s.category_id]));
    for (const subId of subcategory_ids) {
      if (subCatMap.get(subId) !== category_id) {
        return res.status(400).json({ error: 'A subcategory does not belong to the given category' });
      }
    }
  }

  const { error } = await supabaseAdmin
    .from('club_interests')
    .upsert(
      { club_id: clubId, category_id, subcategory_ids },
      { onConflict: 'club_id' }
    );

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.status(204).end();
});

// DELETE /api/clubs/:clubId/interests
// Approved club accounts only. Removes the club's category assignment entirely.
router.delete('/:clubId/interests', writeLimiter, requireAuth, async (req, res) => {
  const { clubId } = req.params;

  const { data: approved, error: approvedError } = await supabaseAdmin
    .from('approved_club_accounts')
    .select('user_id')
    .eq('user_id', req.user.id)
    .eq('club_id', clubId)
    .maybeSingle();

  if (approvedError) {
    const err = new Error(approvedError.message);
    err.status = 502;
    throw err;
  }
  if (!approved) {
    return res.status(403).json({ error: 'Not authorized for this club' });
  }

  const { error } = await supabaseAdmin
    .from('club_interests')
    .delete()
    .eq('club_id', clubId);

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.status(204).end();
});

export default router;
