import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

router.use(requireAuth);

// Pattern: backend mints a short-lived signed upload URL, browser PUTs the
// file bytes directly to Supabase Storage. We never proxy megabytes through
// Express, but the service-role key stays on the server.
//
// Response shape: { signedUrl, token, path, publicUrl }
//   signedUrl — what the browser sends the PUT to
//   publicUrl — the URL the client should save in the DB row after upload
async function makeSignedUpload(bucket, path, res) {
    const { data, error } = await supabaseAdmin
        .storage
        .from(bucket)
        .createSignedUploadUrl(path);

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    const { data: publicData } = supabaseAdmin
        .storage
        .from(bucket)
        .getPublicUrl(path);

    res.json({
        signedUrl: data.signedUrl,
        token: data.token,
        path,
        publicUrl: publicData.publicUrl,
    });
}

// Profile avatars: deterministic filename per user (matches existing pattern
// in ProfilePage.jsx), so re-uploads overwrite. The user can only ever
// generate URLs for their own avatar — the server picks the path.
router.post('/profile-upload-url', async (req, res) => {
    const path = `${req.user.id}.webp`;
    await makeSignedUpload('profile_images', path, res);
});

// Review images: many per user, so we randomize. Namespace under the user's
// id so it's obvious who uploaded what and so storage policies can scope
// listing if you ever add them.
router.post('/review-upload-url', async (req, res) => {
    const ext = (req.body?.ext || 'webp').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'webp';
    const rand = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const path = `${req.user.id}/${rand}.${ext}`;
    await makeSignedUpload('review_images', path, res);
});

export default router;
