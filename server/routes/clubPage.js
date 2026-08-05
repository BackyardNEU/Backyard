import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { checkMuted } from '../middleware/checkMuted.js';
import textModerator from '../lib/textModerator.js';

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
// 3. SQL RPC function: get_top_tags(p_club_id uuid, p_limit int DEFAULT 3)
//    Suggested body:
//      SELECT tag, count(*)::int AS cnt
//      FROM reviews, unnest(review_tags) AS tag
//      WHERE club_id = p_club_id
//      GROUP BY tag ORDER BY cnt DESC LIMIT p_limit;
//    Returns: [{ tag: text, cnt: int }, ...]
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
    type: 'club_media',
    order: 1,
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
    order: 2,
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
    order: 3,
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
    order: 4,
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
    order: 5,
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
    order: 6,
    isDisplayed: true,
    data: {
      filterByMembership: false,
    },
  },
  {
    type: 'comments',
    order: 7,
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

export default router;
