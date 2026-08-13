import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { checkMuted } from '../middleware/checkMuted.js';
import { requireModerator } from '../lib/clubPermissions.js';
import { pickClubDetails, validateClubDetails, normalizeInstagram } from '../../shared/clubDetailsValidation.js';
import textModerator from '../lib/textModerator.js';

const router = express.Router();

// Kept separate from PUT /clubs/:clubId/page rather than folded into it:
//
//  - Different table and shape. The page endpoint's contract is { modules: [...] }, an
//    array of jsonb blobs with a module-shaped moderation extractor. These are four flat
//    scalar columns needing email and handle validation. One endpoint would mean two
//    disjoint validation paths behind a body that means two different things.
//  - PUT /page already carries an implicit cross-table write (it syncs club_name and
//    image_url into demo_club_data). Adding four more implicit syncs deepens that wart
//    instead of containing it.
//  - A separate exported allowlist gets its own pinned test, which is the mechanism that
//    stops someone adding `school` to it later.

// PUT /api/clubs/:clubId/details
router.put('/:clubId/details', requireAuth, checkMuted, async (req, res) => {
    const { clubId } = req.params;
    await requireModerator(req.user.id, clubId);

    const patch = pickClubDetails(req.body);
    if (Object.keys(patch).length === 0) {
        return res.status(400).json({ error: 'No writable fields supplied' });
    }

    const check = validateClubDetails(patch);
    if (!check.valid) {
        return res.status(400).json({
            error: check.errors[0].message,
            field: check.errors[0].field,
            errors: check.errors,
        });
    }

    const textCheck = textModerator.checkFields(patch);
    if (!textCheck.clean) {
        return res.status(400).json({ error: textCheck.message, field: textCheck.field });
    }

    // Stored as a bare handle whatever the club pasted in — @name, name, or a full URL.
    if (patch.instagram) patch.instagram = normalizeInstagram(patch.instagram);

    const { data, error } = await supabaseAdmin
        .from('demo_club_data')
        .update(patch)
        .eq('id', clubId)
        .select('club_description, category, email, instagram')
        .single();

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    res.json(data);
});

export default router;
