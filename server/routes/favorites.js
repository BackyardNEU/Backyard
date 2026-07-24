import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { checkMuted } from '../middleware/checkMuted.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
    const { data, error } = await supabaseAdmin
        .from('user_favorites')
        .select('club_id')
        .eq('user_id', req.user.id);

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    res.json(data);
});

router.post('/', checkMuted, async (req, res) => {
    const { club_id } = req.body || {};
    if (!club_id) return res.status(400).json({ error: 'club_id required' });

    // upsert avoids a 23505 unique-violation if the favorite already exists,
    // which is the natural outcome of double-clicks / network retries.
    const { error } = await supabaseAdmin
        .from('user_favorites')
        .upsert(
            { user_id: req.user.id, club_id },
            { onConflict: 'user_id,club_id', ignoreDuplicates: true }
        );

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    res.status(204).end();
});

router.delete('/:clubId', checkMuted, async (req, res) => {
    const { error } = await supabaseAdmin
        .from('user_favorites')
        .delete()
        .eq('user_id', req.user.id)
        .eq('club_id', req.params.clubId);

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    res.status(204).end();
});

export default router;
