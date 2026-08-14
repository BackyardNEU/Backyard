import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAdmin } from '../lib/isAdmin.js';
import { mintToken, hashToken, tokenPrefix } from '../lib/inviteTokens.js';
import { onboardingUrl, ONBOARD_URL } from '../lib/appUrls.js';
import { validateModules } from '../../shared/clubPageValidation.js';
import { pickClubDetails, validateClubDetails, normalizeInstagram } from '../../shared/clubDetailsValidation.js';
import { sanitizeModules } from '../../shared/sanitizeModules.js';
import { validateEvents, toEventRow } from '../../shared/clubEventsValidation.js';
import { validateInterests } from '../../shared/clubInterestsValidation.js';
import textModerator from '../lib/textModerator.js';

const router = express.Router();

router.use(requireAuth, (req, res, next) => requireAdmin(req, res, next));

const MAX_BATCH = 200;
const DEFAULT_DAYS_VALID = 30;
// Presidents forward their link to the e-board. With max_uses=1 the second person gets a
// 410 and reports the link as broken; first-claimer-owns means the extra uses land as
// moderators, not owners.
const DEFAULT_MAX_USES = 5;

// POST /api/admin/onboarding-links — mint one claim link per club.
//
// Four queries regardless of batch size: select clubs, select their live links, one bulk
// revoke, one bulk insert. Idempotent in two places — the handler skips clubs that
// already have a live link unless rotate:true, and the partial unique index
// one_live_onboarding_link_per_club makes a concurrent double-submit impossible.
router.post('/onboarding-links', async (req, res) => {
  const {
    club_ids: clubIds,
    school,
    days_valid: daysValid = DEFAULT_DAYS_VALID,
    max_uses: maxUses = DEFAULT_MAX_USES,
    rotate = false,
  } = req.body ?? {};

  if (!Array.isArray(clubIds) && !school) {
    return res.status(400).json({ error: 'Supply either club_ids or school' });
  }
  if (Array.isArray(clubIds) && clubIds.length > MAX_BATCH) {
    return res.status(400).json({ error: `At most ${MAX_BATCH} clubs per request` });
  }
  if (Array.isArray(clubIds) && !clubIds.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
    return res.status(400).json({ error: 'club_ids must be valid UUIDs' });
  }
  if (!Number.isInteger(daysValid) || daysValid < 1 || daysValid > 90) {
    return res.status(400).json({ error: 'days_valid must be between 1 and 90' });
  }
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 25) {
    return res.status(400).json({ error: 'max_uses must be between 1 and 25' });
  }

  // Checked BEFORE any write. onboardingUrl() throws when ONBOARD_URL is unset, and it
  // was only called while building the response — so a misconfigured environment wrote
  // 150 hashed tokens and then 500'd, destroying every plaintext irrecoverably. A retry
  // then reported them all as 'existing' with url: null.
  if (!ONBOARD_URL) {
    return res.status(500).json({
      error: 'ONBOARD_URL is not configured, so claim links cannot be built. ' +
        'Set it before minting — nothing has been written.',
    });
  }

  let clubQuery = supabaseAdmin
    .from('demo_club_data')
    .select('id, club_name, school, email, instagram');
  clubQuery = Array.isArray(clubIds)
    ? clubQuery.in('id', clubIds)
    : clubQuery.eq('school', school).limit(500);

  const { data: clubs, error: clubsError } = await clubQuery;
  if (clubsError) {
    const err = new Error(clubsError.message);
    err.status = 502;
    throw err;
  }
  if (!clubs?.length) return res.json({ generated_at: new Date().toISOString(), counts: { created: 0, existing: 0 }, rows: [] });

  const ids = clubs.map((c) => c.id);

  // Outreach targets clubs nobody runs yet. Minting for a club that already has an owner
  // is actively harmful: the moment anyone redeems, status flips to 'claimed' and the
  // real owner is 409'd out of their own page and details editor, while the redeemer —
  // only a moderator — cannot submit to clear it. Recovering needs an admin unclaim.
  const { data: owned } = await supabaseAdmin
    .from('club_memberships')
    .select('club_id')
    .in('club_id', ids)
    .eq('role', 'top_moderator');

  const ownedClubs = new Set((owned ?? []).map((m) => m.club_id));

  const { data: liveLinks } = await supabaseAdmin
    .from('club_invite_links')
    .select('id, club_id, token_prefix, expires_at')
    .in('club_id', ids)
    .eq('link_type', 'onboarding')
    .eq('is_revoked', false);

  const liveByClub = new Map((liveLinks ?? []).map((l) => [l.club_id, l]));

  // Expired links still occupy the unique-index slot (the predicate cannot reference
  // now()), so they are revoked before re-minting even without rotate.
  //
  // Owned clubs are excluded here, not just from the insert loop. Revoking first and
  // skipping later killed the live link of a president who was mid-wizard and issued
  // nothing to replace it, while the CSV cheerfully reported a fresh expiry date.
  const now = Date.now();
  const toRevoke = (liveLinks ?? [])
    .filter((l) => !ownedClubs.has(l.club_id))
    .filter((l) => rotate || (l.expires_at && new Date(l.expires_at).getTime() <= now))
    .map((l) => l.id);

  if (toRevoke.length) {
    await supabaseAdmin.from('club_invite_links').update({ is_revoked: true }).in('id', toRevoke);
    const toRevokeSet = new Set(toRevoke);
    for (const l of liveLinks ?? []) if (toRevokeSet.has(l.id)) liveByClub.delete(l.club_id);
  }

  const expiresAt = new Date(now + daysValid * 86_400_000).toISOString();
  const inserts = [];
  const plaintextByClub = new Map();

  for (const club of clubs) {
    if (liveByClub.has(club.id)) continue;
    if (ownedClubs.has(club.id)) continue;
    const token = mintToken();
    plaintextByClub.set(club.id, token);
    inserts.push({
      token_hash: hashToken(token),
      token_prefix: tokenPrefix(token),
      club_id: club.id,
      created_by: req.user.id,
      link_type: 'onboarding',
      max_uses: maxUses,
      expires_at: expiresAt,
    });
  }

  if (inserts.length) {
    const { error: insertError } = await supabaseAdmin.from('club_invite_links').insert(inserts);
    if (insertError) {
      const err = new Error(insertError.message);
      err.status = 502;
      throw err;
    }

    // Seed the pipeline rows so the ops list can show every targeted club, not only the
    // ones that have started.
    await supabaseAdmin.from('club_onboarding').upsert(
      inserts.map((i) => ({ club_id: i.club_id, status: 'unclaimed' })),
      { onConflict: 'club_id', ignoreDuplicates: true }
    );
  }

  const rows = clubs.map((club) => {
    const token = plaintextByClub.get(club.id);
    const existing = liveByClub.get(club.id);
    return {
      club_id: club.id,
      club_name: club.club_name,
      school: club.school,
      contact_email: club.email,
      instagram: club.instagram,
      // A link cannot be re-displayed once minted — only the hash is stored. An
      // "existing" row means: look in the earlier CSV, or re-run with rotate:true.
      result: ownedClubs.has(club.id)
        ? 'skipped_has_owner'
        : (existing ? 'existing' : (rotate ? 'rotated' : 'created')),
      token_prefix: existing ? existing.token_prefix : tokenPrefix(token),
      url: token ? onboardingUrl(token) : null,
      expires_at: existing ? existing.expires_at : expiresAt,
      max_uses: maxUses,
    };
  });

  const payload = {
    generated_at: new Date().toISOString(),
    counts: {
      created: rows.filter((r) => r.result === 'created' || r.result === 'rotated').length,
      existing: rows.filter((r) => r.result === 'existing').length,
      skipped_has_owner: rows.filter((r) => r.result === 'skipped_has_owner').length,
    },
    rows,
  };

  if (req.query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="onboarding-links-${Date.now()}.csv"`);
    return res.send(toCsv(rows));
  }

  res.status(201).json(payload);
});

// GET /api/admin/onboarding-links — the "where does outreach stand" view.
// Never returns tokens, so it is safe to leave open in a browser tab.
router.get('/onboarding-links', async (req, res) => {
  let query = supabaseAdmin
    .from('club_onboarding')
    .select('club_id, status, claimed_at, submitted_at, reviewed_at, demo_club_data(club_name, school, email)');

  if (req.query.status) query = query.eq('status', req.query.status);

  const { data, error } = await query;
  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  const rows = (data ?? [])
    .filter((r) => !req.query.school || r.demo_club_data?.school === req.query.school)
    .map((r) => ({
      club_id: r.club_id,
      club_name: r.demo_club_data?.club_name,
      school: r.demo_club_data?.school,
      contact_email: r.demo_club_data?.email,
      status: r.status,
      claimed_at: r.claimed_at,
      submitted_at: r.submitted_at,
      reviewed_at: r.reviewed_at,
    }));

  if (req.query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    return res.send(toCsv(rows));
  }
  res.json({ count: rows.length, rows });
});

// GET /api/admin/onboarding/pending — the review queue, oldest first.
router.get('/onboarding/pending', async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('club_onboarding')
    .select('club_id, submitted_at, claimed_by, demo_club_data(club_name, school)')
    .eq('status', 'pending_review')
    .order('submitted_at', { ascending: true });

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.json({
    count: data?.length ?? 0,
    rows: (data ?? []).map((r) => ({
      club_id: r.club_id,
      club_name: r.demo_club_data?.club_name,
      school: r.demo_club_data?.school,
      submitted_at: r.submitted_at,
      claimed_by: r.claimed_by,
    })),
  });
});

// GET /api/admin/onboarding/:clubId — full row including the draft, for the review UI.
router.get('/onboarding/:clubId', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('club_onboarding')
    .select('*, demo_club_data(club_name, school, image_url)')
    .eq('club_id', req.params.clubId)
    .maybeSingle();

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }
  if (!data) return res.status(404).json({ error: 'No onboarding record for this club' });
  res.json(data);
});

// POST /api/admin/onboarding/:clubId/approve — publish the draft.
router.post('/onboarding/:clubId/approve', async (req, res) => {
  const { clubId } = req.params;

  const { data: row, error: rowError } = await supabaseAdmin
    .from('club_onboarding')
    .select('club_id, status, draft')
    .eq('club_id', clubId)
    .maybeSingle();

  if (rowError) {
    const err = new Error(rowError.message);
    err.status = 502;
    throw err;
  }
  if (!row) return res.status(404).json({ error: 'No onboarding record for this club' });
  if (row.status !== 'pending_review') {
    return res.status(409).json({ error: `Cannot approve a page with status "${row.status}"`, status: row.status });
  }

  const modules = row.draft?.modules;
  const details = pickClubDetails(row.draft?.details ?? {});

  // Folded in BEFORE validateClubDetails, not after. Assigning it later meant the
  // wizard's description skipped DESCRIPTION_MAX entirely, since basic_info carries no
  // length cap of its own — so an approved page could publish an unbounded blurb.
  const draftBasic = modules?.find?.((m) => m?.type === 'basic_info')?.data;
  if (draftBasic?.description?.trim()) details.club_description = draftBasic.description.trim();

  // Re-validated here rather than trusted from the draft: a rule may have tightened
  // between save and approval, and this is the last gate before the content is public.
  const structure = validateModules(modules);
  if (!structure.valid) {
    return res.status(400).json({ error: 'Draft failed validation', errors: structure.errors });
  }
  const draftInterests = row.draft?.interests ?? {};
  const interestCheck = validateInterests(draftInterests);
  if (!interestCheck.valid) {
    return res.status(400).json({ error: 'Draft failed validation', errors: interestCheck.errors });
  }

  const draftEvents = row.draft?.events ?? [];
  const eventCheck = validateEvents(draftEvents);
  if (!eventCheck.valid) {
    return res.status(400).json({ error: 'Draft failed validation', errors: eventCheck.errors });
  }

  const detailCheck = validateClubDetails(details);
  if (!detailCheck.valid) {
    return res.status(400).json({ error: 'Draft failed validation', errors: detailCheck.errors });
  }
  const textCheck = textModerator.checkFields(details);
  if (!textCheck.clean) {
    return res.status(400).json({ error: textCheck.message, field: textCheck.field });
  }

  const safeModules = sanitizeModules(modules);

  const { error: pageError } = await supabaseAdmin
    .from('club_page_data')
    .upsert({ club_id: clubId, modules: safeModules, updated_at: new Date().toISOString() },
      { onConflict: 'club_id' });
  if (pageError) {
    const err = new Error(pageError.message);
    err.status = 502;
    throw err;
  }

  // Same allowlist the details endpoint uses, so approve is not a mass-assignment
  // bypass around it.
  if (details.instagram) details.instagram = normalizeInstagram(details.instagram);
  // club_description was already folded in and validated above; name and logo mirror
  // what PUT /page syncs, so the public listing matches the approved page.
  const basic = safeModules.find((m) => m.type === 'basic_info')?.data;
  if (basic?.club_name?.trim()) details.club_name = basic.club_name.trim();
  if (basic?.logo_url) details.image_url = basic.logo_url;

  // Subcategories the club typed become taxonomy rows only now, so nothing invented
  // during onboarding joins the shared list before someone has read it. Names already
  // present under this category are reused rather than duplicated, case-insensitively,
  // matching how POST /interests/subcategories behaves.
  if (draftInterests.category_id) {
    const subIds = [];

    for (const sub of draftInterests.subcategories ?? []) {
      if (sub?.id) { subIds.push(sub.id); continue; }

      const name = (sub?.name ?? '').trim();
      if (!name) continue;

      const { data: existing } = await supabaseAdmin
        .from('interest_subcategories')
        .select('id')
        .eq('category_id', draftInterests.category_id)
        .ilike('name', name)
        .maybeSingle();

      if (existing) { subIds.push(existing.id); continue; }

      const { data: created, error: createError } = await supabaseAdmin
        .from('interest_subcategories')
        .insert({ category_id: draftInterests.category_id, name })
        .select('id')
        .single();

      if (createError) {
        const err = new Error(createError.message);
        err.status = 502;
        throw err;
      }
      subIds.push(created.id);
    }

    const { error: interestsError } = await supabaseAdmin
      .from('club_interests')
      .upsert(
        { club_id: clubId, category_id: draftInterests.category_id, subcategory_ids: subIds },
        { onConflict: 'club_id' }
      );

    if (interestsError) {
      const err = new Error(interestsError.message);
      err.status = 502;
      throw err;
    }

    // demo_club_data.category is what search.js filters on, so keep it in step with the
    // taxonomy rather than leaving it on whatever the scraper guessed.
    const { data: cat } = await supabaseAdmin
      .from('interest_categories')
      .select('name')
      .eq('id', draftInterests.category_id)
      .maybeSingle();

    if (cat?.name) details.category = cat.name;
  }

  if (Object.keys(details).length) {
    // Not ignored: swallowing this would mark a page approved while its name, logo and
    // description silently stayed as the scraped originals.
    const { error: detailsError } = await supabaseAdmin
      .from('demo_club_data').update(details).eq('id', clubId);
    if (detailsError) {
      const err = new Error(detailsError.message);
      err.status = 502;
      throw err;
    }
  }

  // Events become real rows only now. Creating them when the club typed them would put
  // them on the public calendar before anyone had reviewed the page.
  if (draftEvents.length) {
    const clubName = details.club_name
      || (await supabaseAdmin.from('demo_club_data').select('club_name').eq('id', clubId).maybeSingle()).data?.club_name
      || '';

    const { error: eventsError } = await supabaseAdmin
      .from('club_events')
      .insert(draftEvents.map((ev) => toEventRow(ev, clubId, clubName)));

    if (eventsError) {
      const err = new Error(eventsError.message);
      err.status = 502;
      throw err;
    }
  }

  const { data, error } = await supabaseAdmin
    .from('club_onboarding')
    .update({
      status: 'approved',
      reviewed_by: req.user.id,
      reviewed_at: new Date().toISOString(),
      review_note: null,
      updated_at: new Date().toISOString(),
    })
    .eq('club_id', clubId)
    .eq('status', 'pending_review')
    .select('club_id, status, reviewed_at')
    .maybeSingle();

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }
  if (!data) return res.status(409).json({ error: 'That club is no longer awaiting review' });

  res.json(data);
});

// POST /api/admin/onboarding/:clubId/request-changes — send it back with a note.
// The draft is left intact so the club edits and resubmits rather than starting over.
router.post('/onboarding/:clubId/request-changes', async (req, res) => {
  const note = (req.body?.note ?? '').trim();
  if (!note) return res.status(400).json({ error: 'A note is required so the club knows what to fix' });
  if (note.length > 1000) return res.status(400).json({ error: 'Note must be 1000 characters or fewer' });

  const { data, error } = await supabaseAdmin
    .from('club_onboarding')
    .update({
      status: 'changes_requested',
      review_note: note,
      reviewed_by: req.user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('club_id', req.params.clubId)
    .eq('status', 'pending_review')
    .select('club_id, status, review_note')
    .maybeSingle();

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }
  if (!data) return res.status(409).json({ error: 'That club is not awaiting review' });
  res.json(data);
});

// POST /api/admin/onboarding/:clubId/unclaim — the escape hatch.
//
// Needed the first time a link reaches the wrong person, which in a link-only flow is a
// matter of when rather than if. Revokes the live link, demotes the claimant, and resets
// the club so a fresh link can be issued.
router.post('/onboarding/:clubId/unclaim', async (req, res) => {
  const { clubId } = req.params;

  const { data: row } = await supabaseAdmin
    .from('club_onboarding')
    .select('club_id, claimed_by, status')
    .eq('club_id', clubId)
    .maybeSingle();

  if (!row) return res.status(404).json({ error: 'No onboarding record for this club' });

  const { error: revokeError } = await supabaseAdmin
    .from('club_invite_links')
    .update({ is_revoked: true })
    .eq('club_id', clubId)
    .eq('link_type', 'onboarding')
    .eq('is_revoked', false);
  if (revokeError) {
    const err = new Error(revokeError.message);
    err.status = 502;
    throw err;
  }

  if (row.claimed_by) {
    const { error: membershipError } = await supabaseAdmin
      .from('club_memberships')
      .delete()
      .eq('user_id', row.claimed_by)
      .eq('club_id', clubId);
    if (membershipError) {
      const err = new Error(membershipError.message);
      err.status = 502;
      throw err;
    }

    const { error: accountError } = await supabaseAdmin
      .from('approved_club_accounts')
      .delete()
      .eq('user_id', row.claimed_by)
      .eq('club_id', clubId);
    if (accountError) {
      const err = new Error(accountError.message);
      err.status = 502;
      throw err;
    }

    // club_memberships is the modern table, but clubEvents.js and reviews.js still read
    // profiles.member_list. Dropping only the membership would leave the wrong person
    // able to see a private club's events.
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('member_list').eq('id', row.claimed_by).single();
    const list = profile?.member_list ?? [];
    if (list.includes(clubId)) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ member_list: list.filter((c) => c !== clubId) })
        .eq('id', row.claimed_by);
      if (profileError) {
        const err = new Error(profileError.message);
        err.status = 502;
        throw err;
      }
    }
  }

  const { data, error } = await supabaseAdmin
    .from('club_onboarding')
    .update({
      status: 'unclaimed',
      claimed_by: null,
      claimed_at: null,
      submitted_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('club_id', clubId)
    .select('club_id, status')
    .single();

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  res.json(data);
});

// Minimal RFC 4180 quoting. A club name containing a comma or a quote is ordinary, and
// a leading =, +, - or @ is treated as a formula by Excel and Sheets, so those are
// prefixed with a single quote.
export function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    let s = String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
}

export default router;
