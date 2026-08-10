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

// Default modules template — written to a club the first time they open edit mode.
// All content is generic placeholder text meant to guide what to fill in.
// basic_info gets the club's real name/logo/description substituted in before writing.
const DEFAULT_MODULES = [
  {
    type: 'basic_info',
    order: 0,
    isDisplayed: true,
    data: {
      logo_url: '',
      club_name: 'Your Club Name',
      description: 'Tell people what your club is about. What do you do, who is it for, and what makes it worth joining?',
      links: [],
    },
  },
  {
    type: 'links',
    order: 1,
    isDisplayed: true,
    // No independent data of its own — reads/writes basic_info.data.links.
    // This entry only exists so Links gets its own accordion slot (title, help text, visibility checkbox).
    data: {},
  },
  {
    type: 'club_media',
    order: 2,
    isDisplayed: true,
    data: {
      posters: [
        {
          order: 0,
          content: [
            { type: 'title', value: 'Example Event' },
            { type: 'text', value: 'Add a short description of this event or moment.' },
          ],
          blob_aspect: '3 / 4',
          poster_text: 'Example Poster',
          poster_color: '#f8fafc',
          blob_image_url: '',
          poster_text_color: '#2b3440',
        },
      ],
    },
  },
  {
    type: 'join',
    order: 3,
    isDisplayed: true,
    data: {
      tabs: [
        { title: 'How to Join', body: 'Describe your rush, application, or tryout process here.' },
        { title: 'What We Look For', body: 'Share what qualities, skills, or experience you value in new members.' },
        { title: 'Tips', body: 'Any advice for people considering applying? What helps someone stand out?' },
      ],
      contactLink: '',
      applicationLink: '',
    },
  },
  {
    type: 'faqs',
    order: 4,
    isDisplayed: true,
    data: {
      faqs: [
        { q: 'Do first-years usually get in?', a: 'Answer here.' },
        { q: "What's the time commitment?", a: 'Answer here.' },
        { q: 'Do I need prior experience?', a: 'Answer here.' },
      ],
    },
  },
  {
    type: 'stats',
    order: 5,
    isDisplayed: true,
    data: {
      stats: [
        { type: 'quantitative', label: 'Time commitment', unit1: 'hrs', unit2: 'week', value: 5 },
        { type: 'quantitative', label: 'Members', unit1: 'people', unit2: '', value: 30 },
        { max: 10, type: 'qualitative', label: 'Competitiveness', value: 6 },
        { max: 10, type: 'qualitative', label: 'Social vibe', value: 8 },
      ],
    },
  },
  {
    type: 'member_roster',
    order: 6,
    isDisplayed: true,
    data: {
      members: [
        { name: 'Member Name', bio: '<p>Add a short bio here.</p>', photo: '', user_id: null, category: 'Leadership' },
        { name: 'Member Name', bio: '', photo: '', user_id: null, category: 'General' },
      ],
      categories: ['Leadership', 'General'],
    },
  },
  {
    type: 'calendar',
    order: 7,
    isDisplayed: true,
    data: {},
  },
  {
    type: 'comments',
    order: 8,
    isDisplayed: true,
    data: {},
  },
];

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

  const moduleTexts = extractModuleText(modules);
  const textCheck = textModerator.checkFields(moduleTexts);
  if (!textCheck.clean) {
    return res.status(400).json({ error: textCheck.message, field: textCheck.field });
  }

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
  res.json({ approved: ['top_moderator', 'moderator'].includes(role), role });
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
