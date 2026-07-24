import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { checkMuted } from '../middleware/checkMuted.js';
import { ImageModerator } from '../lib/imageModerator.js';

const router = express.Router();

router.use(requireAuth);
router.use(checkMuted);

const imageModerator = process.env.CLOUD_VISION_API
    ? new ImageModerator(process.env.CLOUD_VISION_API)
    : null;

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

router.post('/profile-photos-upload-url', async (req, res) => {
    const ext = (req.body?.ext || 'webp').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'webp';
    const rand = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const path = `${req.user.id}/${rand}.${ext}`;
    await makeSignedUpload('profile_photos', path, res);
});

router.post('/club-logo-upload-url', async (req, res) => {
    const { clubId } = req.body;
    const ext = (req.body?.ext || 'webp').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'webp';
    const path = `${clubId}.${ext}`; // one logo per club, re-uploads overwrite
    await makeSignedUpload('club_logos', path, res);
});

router.post('/event-poster-upload-url', async (req, res) => {
    const ext = (req.body?.ext || 'jpg').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'jpg';
    const rand = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const path = `${req.user.id}/${rand}.${ext}`;
    await makeSignedUpload('event_posters', path, res);
});

// Club media short videos (≤15 s on the client): mp4/webm/mov, namespaced per user.
router.post('/club-media-video-upload-url', async (req, res) => {
    const raw = (req.body?.ext || 'mp4').replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase() || 'mp4';
    const allowed = new Set(['mp4', 'webm', 'mov', 'm4v']);
    const ext = allowed.has(raw) ? raw : 'mp4';
    const rand = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const path = `${req.user.id}/${rand}.${ext}`;
    await makeSignedUpload('club_media_videos', path, res);
});

const USER_BUCKETS = new Set([
    'profile_images', 'review_images', 'profile_photos',
    'club_logos', 'event_posters', 'club_media_videos',
]);

const SAFE_IMAGE_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
]);

function parseStorageUrl(publicUrl) {
    let parsed;
    try { parsed = new URL(publicUrl); } catch { return null; }

    const allowed = new URL(process.env.SUPABASE_URL);
    if (parsed.hostname !== allowed.hostname || parsed.protocol !== 'https:'
        || parsed.username || parsed.password) return null;
    if (!parsed.pathname.startsWith('/storage/v1/object/public/')) return null;

    const after = parsed.pathname.slice('/storage/v1/object/public/'.length);
    const segments = after.split('/');
    const bucket = segments[0];
    if (!USER_BUCKETS.has(bucket)) return null;

    return { parsed, bucket, objectPath: segments.slice(1).join('/') };
}

const USER_NAMESPACED_BUCKETS = new Set([
    'review_images', 'profile_photos', 'event_posters', 'club_media_videos',
]);

async function verifyOwnership(bucket, objectPath, userId) {
    if (bucket === 'profile_images') {
        return objectPath.startsWith(`${userId}.`);
    }
    if (USER_NAMESPACED_BUCKETS.has(bucket)) {
        return objectPath.startsWith(`${userId}/`);
    }
    if (bucket === 'club_logos') {
        const clubId = objectPath.split('.')[0];
        const { count } = await supabaseAdmin
            .from('approved_club_accounts')
            .select('id', { count: 'exact', head: true })
            .eq('club_id', clubId)
            .eq('user_id', userId);
        return (count ?? 0) > 0;
    }
    return false;
}

async function verifyContentType(publicUrl) {
    const headRes = await fetch(publicUrl, { method: 'HEAD' });
    if (!headRes.ok) return false;
    const contentType = (headRes.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    return SAFE_IMAGE_TYPES.has(contentType);
}

router.post('/verify-image', async (req, res) => {
    const { publicUrl } = req.body || {};
    if (!publicUrl || typeof publicUrl !== 'string') {
        return res.status(400).json({ ok: false, error: 'publicUrl is required' });
    }

    const urlInfo = process.env.SUPABASE_URL && parseStorageUrl(publicUrl);
    if (!urlInfo) {
        return res.status(400).json({ ok: false, error: 'Invalid storage URL' });
    }

    const owned = await verifyOwnership(urlInfo.bucket, urlInfo.objectPath, req.user.id);
    if (!owned) {
        return res.status(403).json({ ok: false, error: 'You do not own this file' });
    }

    const isImage = await verifyContentType(publicUrl);
    if (!isImage) {
        if (imageModerator) await imageModerator.deleteFromStorage(publicUrl);
        return res.status(400).json({ ok: false, error: 'File is not a valid image' });
    }

    if (!imageModerator) {
        return res.json({ ok: true });
    }

    const result = await imageModerator.scan(publicUrl);

    if (result.safe) {
        return res.json({ ok: true });
    }

    await imageModerator.deleteFromStorage(publicUrl);

    const strike = await imageModerator.recordStrike(
        req.user.id,
        result.violations[0].category,
        { publicUrl, violations: result.violations },
    );

    const response = {
        ok: false,
        error: 'Your image was detected to have inappropriate content',
        strikes: strike.strikes,
    };

    if (strike.muted) {
        response.muted = true;
        response.muted_until = strike.mutedUntil;
    }

    res.status(422).json(response);
});

export default router;
