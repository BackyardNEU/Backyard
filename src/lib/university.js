// School selection is disabled for now, so every "go to the university page"
// link resolves to the same place. That id was copied into four separate files;
// keeping it here means the eventual move to readable slugs
// (/university/Northeastern) is one edit rather than a hunt.
export const DEFAULT_UNIVERSITY_ID = '38500bfc-e606-46a7-840d-720b11ad2e8b';

// The readable slug, not the id. UniversityPage accepts either, but when handed a UUID
// it resolves the club data and then rewrites the URL to the slug — so pointing every
// internal link at the id meant the address bar visibly flipped on each entry and left a
// redundant history entry behind. Going straight to the slug skips that hop.
export const DEFAULT_UNIVERSITY_PATH = '/university/Northeastern';
