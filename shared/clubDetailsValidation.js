// Write allowlist and validation for the flat demo_club_data columns a club can edit.
//
// No endpoint wrote these before the onboarding wizard — PUT /clubs/:clubId/page only
// syncs club_name and image_url. Following the pickWritable pattern from
// server/routes/profiles.js, which is this repo's answer to mass assignment, and pinning
// the field set with a test so widening it is a deliberate act.

export const CLUB_DETAILS_WRITABLE = new Set([
    'club_description',
    'category',
    'email',
    'instagram',
]);

// Deliberately NOT writable, and why:
//   school         exact-string join to uni_names.uni_name — editing it moves the club
//                  between universities and silently breaks every school-match check
//   club_name      owned by the PUT /page basic_info sync
//   image_url      same
//   join_policy    has its own top-moderator endpoint (clubMembers.js)
//   rating, id, university_id   not user data

export const DETAIL_LIMITS = {
    DESCRIPTION_MAX: 2000,
    CATEGORY_MAX: 60,
    EMAIL_MAX: 254,
    INSTAGRAM_MAX: 30,
};

export function pickClubDetails(body) {
    const out = {};
    if (!body || typeof body !== 'object') return out;

    for (const key of Object.keys(body)) {
        if (!CLUB_DETAILS_WRITABLE.has(key)) continue;
        const value = body[key];
        // An explicitly-sent empty string means "clear this", stored as NULL. Dropping it
        // meant a club could never remove an email or Instagram handle they had already
        // saved: the wizard showed it gone in the local draft while approve went on
        // publishing the stale value. Absent keys are still left untouched, so a partial
        // save cannot blank a column it never mentioned.
        if (value === null || (typeof value === 'string' && value.trim() === '')) {
            out[key] = null;
            continue;
        }
        out[key] = typeof value === 'string' ? value.trim() : value;
    }
    return out;
}

const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;

/**
 * Accepts "@handle", "handle", or a profile URL and returns the bare handle.
 * @returns {string|null} null when the input is not a usable handle
 */
export function normalizeInstagram(value) {
    if (!value || typeof value !== 'string') return null;
    let v = value.trim();

    const urlMatch = /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#]+)/i.exec(v);
    if (urlMatch) v = urlMatch[1];

    v = v.replace(/^@/, '').replace(/\/+$/, '');

    return HANDLE_RE.test(v) ? v : null;
}

// Deliberately permissive: this rejects obvious typos without trying to be an authority
// on what an address may contain.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @returns {{ valid: boolean, errors: Array<{ field: string, message: string }> }}
 */
export function validateClubDetails(details) {
    const errors = [];
    const d = details ?? {};

    if (d.club_description != null && String(d.club_description).length > DETAIL_LIMITS.DESCRIPTION_MAX) {
        errors.push({ field: 'club_description', message: 'Description must be 2000 characters or fewer.' });
    }

    if (d.category != null && String(d.category).length > DETAIL_LIMITS.CATEGORY_MAX) {
        errors.push({ field: 'category', message: 'Category must be 60 characters or fewer.' });
    }

    if (d.email != null && d.email !== '') {
        const email = String(d.email);
        if (email.length > DETAIL_LIMITS.EMAIL_MAX || !EMAIL_RE.test(email)) {
            errors.push({ field: 'email', message: 'Enter a valid email address.' });
        }
    }

    if (d.instagram != null && d.instagram !== '' && normalizeInstagram(d.instagram) === null) {
        errors.push({
            field: 'instagram',
            message: 'Enter an Instagram handle, like @yourclub.',
        });
    }

    return { valid: errors.length === 0, errors };
}
