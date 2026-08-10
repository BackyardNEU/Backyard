// URL slugs for universities.
//
// Derived from uni_name rather than stored in a column. That means there is no migration
// to run, no second source of truth, and no way for a slug to drift out of sync with the
// name it represents when a school gets renamed.
//
// Case is preserved so the URL reads the way the school writes its own name —
// /university/Northeastern rather than /university/northeastern — while resolution is
// case-insensitive, so a hand-typed lowercase URL still works.
//
// Single source of truth: the client builds links with it, the server resolves them with
// it. If the two ever disagreed, every link in the app would 404.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a canonical UUID. Checked before slug resolution so old links keep working. */
export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * "Boston University"   -> "Boston-University"
 * "St. John's College"  -> "St-Johns-College"
 * "Texas A&M"           -> "Texas-AM"
 */
export function slugifyUniversity(name) {
  return String(name ?? '')
    .trim()
    // Drop punctuation entirely rather than mapping it to hyphens, so "St. John's"
    // becomes "St-Johns" and not "St--John-s".
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Case-insensitive comparison of a URL segment against a university name. */
export function slugMatches(slug, uniName) {
  return slugifyUniversity(slug).toLowerCase() === slugifyUniversity(uniName).toLowerCase();
}
