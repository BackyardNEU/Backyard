import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateUsername } from '../lib/validateUsername.js';

const router = express.Router();

router.get('/check-username', async (req, res) => {
    const { valid, normalized, reason } = validateUsername(req.query.username);
    if (!valid) {
        return res.json({ available: false, reason });
    }

    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('username', normalized)
        .limit(1);

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    res.json({ available: data.length === 0 });
});

router.use(requireAuth);

// GET /api/users/search?q=...
// Used by FriendDiscoveryList's username autocomplete.
router.get('/search', async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (q.length === 0) return res.json([]);

    // Escape % and _ so a user typing them doesn't widen the search themselves.
    const escaped = q.replace(/[\\%_]/g, (ch) => '\\' + ch);

    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, username, avatar_url')
        .ilike('username', `%${escaped}%`)
        .neq('id', req.user.id)
        .limit(10);

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    res.json(data);
});

export default router;
