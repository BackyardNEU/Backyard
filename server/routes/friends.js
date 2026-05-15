import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

router.use(requireAuth);

// Returns the friend profiles (not just IDs) so the client renders without
// a follow-up round trip. Matches the shape ClubDataProvider/FriendDiscoveryList
// already expect.
router.get('/', async (req, res) => {
    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('friend_list')
        .eq('id', req.user.id)
        .single();

    if (profileError) {
        const err = new Error(profileError.message);
        err.status = 502;
        throw err;
    }

    const friendIds = profile?.friend_list || [];
    if (friendIds.length === 0) return res.json([]);

    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, username, avatar_url, member_list')
        .in('id', friendIds);

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    res.json(data);
});

// PUT /api/me/friends with { friend_list: [...] }.
// Caveat: replacing the whole array means concurrent add/remove from two tabs
// will race — last write wins. Per-friend POST/DELETE with array_append would
// be safer; PUT-the-whole-array matches BACKEND_PLAN.md and the current
// frontend pattern, so sticking with it.
router.put('/', async (req, res) => {
    const { friend_list } = req.body || {};
    if (!Array.isArray(friend_list)) {
        return res.status(400).json({ error: 'friend_list must be an array' });
    }

    // Defense in depth: don't let a user add themselves, and dedupe.
    const cleaned = [...new Set(friend_list.filter((id) => id && id !== req.user.id))];

    const { error } = await supabaseAdmin
        .from('profiles')
        .update({ friend_list: cleaned })
        .eq('id', req.user.id);

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    res.status(204).end();
});

export default router;
