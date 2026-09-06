// Validation for the category and subcategories a club picks during onboarding.
//
// Matches the shape club_interests already stores and PUT /clubs/:clubId/interests
// already accepts: one category, and subcategory ids that must belong to it. The wizard
// requires exactly two, since one word rarely describes a club well enough for search
// and the taxonomy is more useful when everyone fills it in the same way.
//
// A subcategory is either an existing row (has an id) or a name the club typed. Typed
// ones are created at approval rather than on save, so nothing a club invents reaches
// the shared taxonomy before someone has looked at it.

export const INTEREST_LIMITS = {
    REQUIRED_SUBCATEGORIES: 2,
    // interests.js enforces the same bounds when creating a subcategory.
    NAME_MIN: 2,
    NAME_MAX: 50,
};

/**
 * @param {{ category_id?: string, subcategories?: Array<{id?: string, name?: string}> }} interests
 * @param {{ partial?: boolean }} opts partial skips "not filled in yet" for autosaves.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateInterests(interests, { partial = false } = {}) {
    const errors = [];
    const subs = interests?.subcategories ?? [];

    if (!partial && !interests?.category_id) {
        errors.push('Pick a category for your club.');
    }

    if (!Array.isArray(subs)) {
        return { valid: false, errors: ['Subcategories must be a list.'] };
    }

    if (subs.length > INTEREST_LIMITS.REQUIRED_SUBCATEGORIES) {
        errors.push('Pick two subcategories.');
    }

    const named = subs.filter((s) => (s?.name ?? '').trim());

    if (!partial && named.length !== INTEREST_LIMITS.REQUIRED_SUBCATEGORIES) {
        errors.push('Pick two subcategories, or type your own.');
    }

    for (const sub of named) {
        const name = sub.name.trim();
        if (name.length < INTEREST_LIMITS.NAME_MIN) {
            errors.push('Subcategory names need at least 2 characters.');
        }
        if (name.length > INTEREST_LIMITS.NAME_MAX) {
            errors.push('Subcategory names must be 50 characters or fewer.');
        }
    }

    // Two identical entries store as one and quietly leave the club with a single tag.
    const seen = new Set();
    for (const sub of named) {
        const key = sub.name.trim().toLowerCase();
        if (seen.has(key)) {
            errors.push('Those two subcategories are the same. Pick something different.');
            break;
        }
        seen.add(key);
    }

    return { valid: errors.length === 0, errors: [...new Set(errors)] };
}
