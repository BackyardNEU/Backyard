import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { checkMuted } from '../middleware/checkMuted.js';
import textModerator from '../lib/textModerator.js';

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
        .from('profiles')
        .select('member_list')
        .eq('id', req.user.id)
        .single();

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    res.json({ member_list: data?.member_list || [] });
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

export default router;
