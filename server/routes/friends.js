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

// GET /api/me/friends/suggestions
// Returns up to 20 ranked non-friend profiles the user might want to add.
// Scoring (higher = more relevant):
//   - Graduation year: same=3000pts, ±1yr=2000pts, ±2yr=1000pts
//   - Mutual friends:  10pts each
//   - Same school:     1pt
// Only returns profiles with score > 0.
router.get('/suggestions', async (req, res) => {
    // 1. Fetch current user's scoring data
    const { data: me, error: meError } = await supabaseAdmin
        .from('profiles')
        .select('graduation_year, school, friend_list')
        .eq('id', req.user.id)
        .single();

    if (meError) {
        // Column missing (schema migration not yet run) — return empty gracefully
        if (meError.message?.includes('does not exist')) {
            console.warn('[friends/suggestions] Schema migration pending:', meError.message);
            return res.json([]);
        }
        const err = new Error(meError.message);
        err.status = 502;
        throw err;
    }

    const myFriendList = me?.friend_list || [];
    const myGradYear   = me?.graduation_year ?? null;
    const mySchool     = me?.school ?? null;
    const myFriendSet  = new Set(myFriendList);

    // Exclude self + current friends
    const excludedIds = [req.user.id, ...myFriendList];

    // 2. Fetch candidate profiles (capped at 300 for a single-university app)
    let query = supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, username, avatar_url, photos, graduation_year, school, friend_list')
        .limit(300);

    if (excludedIds.length > 0) {
        query = query.not('id', 'in', `(${excludedIds.join(',')})`);
    }

    const { data: candidates, error: candError } = await query;

    if (candError) {
        // Column missing (schema migration not yet run) — return empty gracefully
        if (candError.message?.includes('does not exist')) {
            console.warn('[friends/suggestions] Schema migration pending:', candError.message);
            return res.json([]);
        }
        const err = new Error(candError.message);
        err.status = 502;
        throw err;
    }

    // 3. Score and filter
    const suggestions = (candidates || [])
        .map((c) => {
            let gradScore = 0;
            if (myGradYear && c.graduation_year) {
                const diff = Math.abs(c.graduation_year - myGradYear);
                if (diff === 0)      gradScore = 3;
                else if (diff === 1) gradScore = 2;
                else if (diff === 2) gradScore = 1;
            }

            const mutualCount = (c.friend_list || []).filter((id) => myFriendSet.has(id)).length;
            const schoolScore = mySchool && c.school && mySchool === c.school ? 1 : 0;
            const score       = gradScore * 1000 + mutualCount * 10 + schoolScore;

            return {
                id: c.id,
                first_name: c.first_name,
                last_name: c.last_name,
                username: c.username,
                avatar_url: c.avatar_url,
                photos: c.photos || [],
                graduation_year: c.graduation_year,
                mutual_count: mutualCount,
                score,
            };
        })
        .filter((c) => c.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);

    res.json(suggestions);
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
