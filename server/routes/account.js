import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

router.use(requireAuth);

// Buckets holding files owned by an individual user. Club-owned buckets (club_logos,
// event_posters, club_media_videos) are deliberately absent — that content belongs to the
// club and survives a member leaving.
const USER_OWNED_BUCKETS = ['profile_images', 'profile_photos', 'review_images'];

// Storage is not covered by any foreign key, so deleting the database rows would leave
// the actual image files behind indefinitely. Best-effort: a storage failure must not
// abort the deletion, since a user who asked to be deleted should be deleted.
async function deleteUserStorage(userId) {
    for (const bucket of USER_OWNED_BUCKETS) {
        try {
            // Files are namespaced per user: either `<uuid>/<file>` or `<uuid>.<ext>`.
            const { data: files, error } = await supabaseAdmin.storage.from(bucket).list(userId);
            if (error) continue;

            const paths = (files || []).map((f) => `${userId}/${f.name}`);
            if (paths.length > 0) {
                await supabaseAdmin.storage.from(bucket).remove(paths);
            }
        } catch (err) {
            console.error(`[account] storage cleanup failed for ${bucket}:`, err.message);
        }
    }

    // profile_images uses `<uuid>.<ext>` at the bucket root rather than a folder.
    try {
        const { data: rootFiles } = await supabaseAdmin.storage.from('profile_images').list('');
        const owned = (rootFiles || [])
            .filter((f) => f.name.startsWith(`${userId}.`))
            .map((f) => f.name);
        if (owned.length > 0) {
            await supabaseAdmin.storage.from('profile_images').remove(owned);
        }
    } catch (err) {
        console.error('[account] avatar cleanup failed:', err.message);
    }
}

// DELETE /api/me/account
//
// Irreversible. Ordered so that a failure part-way through leaves the account usable
// rather than half-deleted: storage first (orphaned files are recoverable-ish and
// harmless), then the atomic SQL function, then the auth row.
router.delete('/', async (req, res) => {
    const userId = req.user.id;

    // Require the caller to name themselves. Guards against a mis-wired client firing a
    // bodyless DELETE, which is otherwise indistinguishable from a deliberate one.
    const confirmUsername = req.body?.confirmUsername;
    if (typeof confirmUsername !== 'string' || !confirmUsername.trim()) {
        return res.status(400).json({ error: 'confirmUsername is required' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .maybeSingle();

    if (profileError) {
        const err = new Error(profileError.message);
        err.status = 502;
        throw err;
    }
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    if (confirmUsername.trim().toLowerCase() !== (profile.username || '').toLowerCase()) {
        return res.status(400).json({ error: 'That username does not match your account' });
    }

    await deleteUserStorage(userId);

    // One transaction: strips the user out of every friend_list (a uuid[] with no foreign
    // key, so nothing cascades it), anonymizes their reviews, and deletes their rows.
    const { error: rpcError } = await supabaseAdmin.rpc('delete_user_account', {
        p_user_id: userId,
    });

    if (rpcError) {
        console.error('[account] delete_user_account failed:', rpcError.message);
        const err = new Error('Could not delete your account. Please try again.');
        err.status = 502;
        throw err;
    }

    // Last, and the only auth.admin write in the codebase. If this fails the data is gone
    // but the login still works, so report it rather than pretending success.
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authError) {
        console.error('[account] auth user deletion failed:', authError.message);
        const err = new Error('Your data was removed but the login could not be deleted. Contact support.');
        err.status = 502;
        throw err;
    }

    res.status(204).end();
});

export default router;
