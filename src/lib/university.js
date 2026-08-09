// School selection is disabled for now, so every "go to the university page"
// link resolves to the same place. That id was copied into four separate files;
// keeping it here means the eventual move to readable slugs
// (/university/Northeastern) is one edit rather than a hunt.
export const DEFAULT_UNIVERSITY_ID = '38500bfc-e606-46a7-840d-720b11ad2e8b';

export const DEFAULT_UNIVERSITY_PATH = `/university/${DEFAULT_UNIVERSITY_ID}`;
