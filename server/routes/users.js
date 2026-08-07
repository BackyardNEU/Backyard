import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateUsername } from '../lib/validateUsername.js';
import { getBlockedIds, isBlockedBetween } from '../lib/blocks.js';

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

    const blockedIds = await getBlockedIds(req.user.id);

    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, username, avatar_url')
        // Over-fetch so that filtering blocked users out below does not shrink the
        // result set below what the caller asked for.
        .ilike('username', `%${escaped}%`)
        .neq('id', req.user.id)
        .limit(10 + blockedIds.size);

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    res.json((data || []).filter((u) => !blockedIds.has(u.id)).slice(0, 10));
});

// GET /api/users/:id/profile
// Public-readable profile fields for any user plus mutual_friends with the
// requester (intersection of both friend_lists, resolved to profile rows).
// FriendProfile.jsx renders this — never expose write-side fields here.
router.get('/:id/profile', async (req, res) => {
    const targetId = req.params.id;
    if (!targetId) return res.status(400).json({ error: 'id required' });

    // 404 rather than 403 when a block exists in either direction. A 403 would confirm
    // that the account exists and that one of the two blocked the other, which is exactly
    // what blocking is meant to withhold. FriendProfile.jsx already renders 404 as
    // "User not found."
    if (await isBlockedBetween(req.user.id, targetId)) {
        return res.status(404).json({ error: 'User not found' });
    }

    const { data: target, error: targetErr } = await supabaseAdmin
        .from('profiles')
        .select('id, username, avatar_url, biography, photos, member_list, friend_list')
        .eq('id', targetId)
        .single();

    if (targetErr) {
        const err = new Error(targetErr.message);
        err.status = targetErr.code === 'PGRST116' ? 404 : 502;
        throw err;
    }

    const { data: viewer, error: viewerErr } = await supabaseAdmin
        .from('profiles')
        .select('friend_list')
        .eq('id', req.user.id)
        .single();

    if (viewerErr) {
        const err = new Error(viewerErr.message);
        err.status = 502;
        throw err;
    }

    // Blocked users must not surface as a mutual friend on some third party's profile.
    const blockedIds = await getBlockedIds(req.user.id);
    const viewerFriends = new Set(viewer?.friend_list || []);
    const mutualIds = (target?.friend_list || [])
        .filter((id) => viewerFriends.has(id))
        .filter((id) => !blockedIds.has(id));

    let mutual_friends = [];
    if (mutualIds.length > 0) {
        const { data: mutuals, error: mutualsErr } = await supabaseAdmin
            .from('profiles')
            .select('id, username, avatar_url')
            .in('id', mutualIds);
        if (mutualsErr) {
            const err = new Error(mutualsErr.message);
            err.status = 502;
            throw err;
        }
        mutual_friends = mutuals || [];
    }

    // friend_list is only needed server-side for the intersection above.
    const { friend_list, ...publicProfile } = target;
    res.json({ ...publicProfile, mutual_friends });
});

export default router;
