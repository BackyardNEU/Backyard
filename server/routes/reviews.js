import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

router.use(requireAuth);

const REVIEW_WRITABLE = new Set([
    'club_id',
    'review_text',
    'review_title',
    'review_tags',
    'club_hours',
    'club_leadership',
    'club_fun',
    'club_community',
    'club_growth_index',
    'review_images',
]);

function pickWritable(body) {
    const out = {};
    for (const key of Object.keys(body || {})) {
        if (REVIEW_WRITABLE.has(key)) out[key] = body[key];
    }
    return out;
}

router.post('/', async (req, res) => {
    const patch = pickWritable(req.body);
    if (!patch.club_id) {
        return res.status(400).json({ error: 'club_id required' });
    }

    // user_id always comes from the verified JWT, never from the body.
    const row = { ...patch, user_id: req.user.id };

    const { data, error } = await supabaseAdmin
        .from('reviews')
        .insert(row)
        .select()
        .single();

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    res.status(201).json(data);
});

export default router;
