import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { checkMuted } from '../middleware/checkMuted.js';
import textModerator from '../lib/textModerator.js';
import { WILDCARD_TYPE } from '../notifications/decisionLayer.js';

const router = express.Router();

router.use(requireAuth);

// Whitelist of fields the user is allowed to write to their own profile.
// Anything else in the body is ignored — prevents privilege-escalation by
// posting columns like { id: <someone else's uuid> } or { is_admin: true }.
export const PROFILE_WRITABLE = new Set([
    'username',
    'first_name',
    'last_name',
    'avatar_url',
    'biography',
    'photos',
    'school',
    'graduation_year',
    'major',
    // Which format "Add to calendar" uses: 'ics' (universal) or 'google'. Set from the
    // settings page. Without an entry here pickWritable would silently drop it.
    'calendar_preference',
]);

export function pickWritable(body) {
    const out = {};
    for (const key of Object.keys(body || {})) {
        if (PROFILE_WRITABLE.has(key)) out[key] = body[key];
    }
    return out;
}

router.get('/profile', async (req, res) => {
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', req.user.id)
        .single();

    if (error) {
        const err = new Error(error.message);
        err.status = error.code === 'PGRST116' ? 404 : 502;
        throw err;
    }

    res.json(data);
});

router.put('/profile', checkMuted, async (req, res) => {
    const patch = pickWritable(req.body);
    if (Object.keys(patch).length === 0) {
        return res.status(400).json({ error: 'No writable fields supplied' });
    }

    const textCheck = textModerator.checkFields({
        biography: patch.biography,
        first_name: patch.first_name,
        last_name: patch.last_name,
        username: patch.username,
    });
    if (!textCheck.clean) {
        return res.status(400).json({ error: textCheck.message });
    }

    const { data, error } = await supabaseAdmin
        .from('profiles')
        .update(patch)
        .eq('id', req.user.id)
        .select()
        .single();

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    res.json(data);
});

// Upsert variant for first-login profile creation (AuthListener uses this).
// The id is always forced from the JWT, never trusted from the body.
router.post('/profile', checkMuted, async (req, res) => {
    const patch = pickWritable(req.body);

    // This route exists to guarantee a profile row on first login, and it upserts — so
    // anything present in the body overwrites what is already stored. A caller passing a
    // blank field therefore erases real data, which is exactly what AuthListener did on
    // every auth state change.
    //
    // Empty values are dropped here rather than only fixed in the caller, because the
    // damage is silent and permanent and any future caller would hit the same edge.
    // PUT /profile is the update path and still accepts empty strings, so clearing a
    // biography deliberately continues to work.
    for (const key of Object.keys(patch)) {
        if (typeof patch[key] === 'string' && patch[key].trim() === '') delete patch[key];
    }

    const textCheck = textModerator.checkFields({
        biography: patch.biography,
        first_name: patch.first_name,
        last_name: patch.last_name,
        username: patch.username,
    });
    if (!textCheck.clean) {
        return res.status(400).json({ error: textCheck.message });
    }

    const row = { id: req.user.id, email: req.user.email, ...patch };

    const { data, error } = await supabaseAdmin
        .from('profiles')
        .upsert(row, { onConflict: 'id' })
        .select()
        .single();

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    res.json(data);
});

router.get('/membership', async (req, res) => {
    const { data, error } = await supabaseAdmin
        .from('club_memberships')
        .select('club_id')
        .eq('user_id', req.user.id);

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    res.json({ member_list: (data || []).map((r) => r.club_id) });
});

router.put('/membership', async (req, res) => {
    const { member_list } = req.body || {};
    if (!Array.isArray(member_list)) {
        return res.status(400).json({ error: 'member_list must be an array' });
    }

    const { error } = await supabaseAdmin
        .from('profiles')
        .update({ member_list })
        .eq('id', req.user.id);

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    res.status(204).end();
});

// ─── Notification preferences ────────────────────────────────────────────────────────
// Rows in notification_preferences are negative overrides: no row means enabled. The
// settings page offers per-channel master toggles rather than a type x channel matrix, so
// it reads and writes only WILDCARD_TYPE rows, which decisionLayer applies to every type.

// Only channels a user can meaningfully control. 'push' is excluded deliberately —
// channels/push.js is a stub that returns 'skipped:not-implemented', so a toggle for it
// would claim to do something it does not.
const SETTABLE_CHANNELS = ['in_app', 'email'];

router.get('/notification-preferences', async (req, res) => {
    const { data, error } = await supabaseAdmin
        .from('notification_preferences')
        .select('channel, enabled')
        .eq('user_id', req.user.id)
        .eq('type', WILDCARD_TYPE);

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    // Absence of a row means enabled, so start everything on and let rows turn things off.
    const prefs = Object.fromEntries(SETTABLE_CHANNELS.map((c) => [c, true]));
    for (const row of data || []) {
        if (row.channel in prefs) prefs[row.channel] = row.enabled;
    }

    res.json(prefs);
});

router.put('/notification-preferences', async (req, res) => {
    const body = req.body || {};

    const updates = SETTABLE_CHANNELS
        .filter((channel) => typeof body[channel] === 'boolean')
        .map((channel) => ({
            user_id: req.user.id,
            type: WILDCARD_TYPE,
            channel,
            enabled: body[channel],
        }));

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No settable channels supplied' });
    }

    // Upsert rather than insert-or-delete: keeping an explicit `enabled: true` row is
    // harmless, and it means re-enabling a channel does not depend on a delete succeeding.
    const { error } = await supabaseAdmin
        .from('notification_preferences')
        .upsert(updates, { onConflict: 'user_id,type,channel' });

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    res.status(204).end();
});

export default router;
