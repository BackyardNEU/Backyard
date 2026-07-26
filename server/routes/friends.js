import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { checkMuted } from '../middleware/checkMuted.js';

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

router.delete('/:friendId', async (req, res) => {
    const { friendId } = req.params;

    const { data: profile, error: fetchError } = await supabaseAdmin
        .from('profiles')
        .select('friend_list')
        .eq('id', req.user.id)
        .single();

    if (fetchError) {
        const err = new Error(fetchError.message);
        err.status = 502;
        throw err;
    }

    const newList = (profile?.friend_list || []).filter((id) => id !== friendId);

    const { error } = await supabaseAdmin
        .from('profiles')
        .update({ friend_list: newList })
        .eq('id', req.user.id);

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    res.status(204).end();
});

export default router;
