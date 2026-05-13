import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

router.use(requireAuth);

//Move aggregation+update into one DB-side transactional operation (RPC/function or trigger) and call that from the route.
async function recomputeUpvotes(reviewId) {
    const { data, error: sumError } = await supabaseAdmin
        .from('user_votes')
        .select('vote')
        .eq('review_id', reviewId);

    if (sumError) throw sumError;

    const total = (data || []).reduce((acc, row) => acc + (row.vote || 0), 0);

    const { error: updateError } = await supabaseAdmin
        .from('reviews')
        .update({ upvotes: total })
        .eq('id', reviewId);

    if (updateError) throw updateError;

    return total;
}

// GET /api/me/votes?reviewIds=a,b,c  → only the current user's votes
router.get('/', async (req, res) => {
    const idsParam = req.query.reviewIds;
    if (!idsParam) return res.json([]);

    const ids = String(idsParam).split(',').filter(Boolean);
    if (ids.length === 0) return res.json([]);

    const { data, error } = await supabaseAdmin
        .from('user_votes')
        .select('review_id, vote')
        .eq('user_id', req.user.id)
        .in('review_id', ids);

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    res.json(data);
});

router.post('/', async (req, res) => {
    const { review_id, vote } = req.body || {};
    if (!review_id) return res.status(400).json({ error: 'review_id required' });
    if (vote !== 1 && vote !== -1) {
        return res.status(400).json({ error: 'vote must be 1 or -1' });
    }

    const { error } = await supabaseAdmin
        .from('user_votes')
        .upsert(
            { user_id: req.user.id, review_id, vote },
            { onConflict: 'user_id,review_id' }
        );

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    const upvotes = await recomputeUpvotes(review_id);
    res.json({ upvotes });
});

router.delete('/:reviewId', async (req, res) => {
    const { reviewId } = req.params;

    const { error } = await supabaseAdmin
        .from('user_votes')
        .delete()
        .eq('user_id', req.user.id)
        .eq('review_id', reviewId);

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    const upvotes = await recomputeUpvotes(reviewId);
    res.json({ upvotes });
});

export default router;
