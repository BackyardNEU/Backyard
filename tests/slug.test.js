import { describe, it, expect } from 'vitest';
import { slugifyUniversity, slugMatches, isUuid } from '../shared/slug.js';

describe('slugifyUniversity', () => {
    // Case is preserved deliberately so the URL reads the way a school writes its name.
    it('keeps a single-word name as-is', () => {
        expect(slugifyUniversity('Northeastern')).toBe('Northeastern');
    });

    it('hyphenates spaces', () => {
        expect(slugifyUniversity('Boston University')).toBe('Boston-University');
    });

    // Punctuation is dropped rather than mapped to hyphens, so this does not become
    // "St--John-s-College".
    it('drops punctuation instead of turning it into separators', () => {
        expect(slugifyUniversity("St. John's College")).toBe('St-Johns-College');
        expect(slugifyUniversity('Texas A&M')).toBe('Texas-AM');
    });

    it('collapses runs of whitespace and hyphens', () => {
        expect(slugifyUniversity('  Boston   College  ')).toBe('Boston-College');
        expect(slugifyUniversity('Foo -- Bar')).toBe('Foo-Bar');
    });

    it('trims leading and trailing hyphens', () => {
        expect(slugifyUniversity('-Northeastern-')).toBe('Northeastern');
    });

    it('handles null and undefined without throwing', () => {
        expect(slugifyUniversity(null)).toBe('');
        expect(slugifyUniversity(undefined)).toBe('');
    });
});

describe('slugMatches', () => {
    it('matches the canonical slug', () => {
        expect(slugMatches('Boston-University', 'Boston University')).toBe(true);
    });

    // A hand-typed URL should still resolve.
    it('is case-insensitive', () => {
        expect(slugMatches('northeastern', 'Northeastern')).toBe(true);
        expect(slugMatches('NORTHEASTERN', 'Northeastern')).toBe(true);
    });

    it('matches when the URL carries punctuation the slug drops', () => {
        expect(slugMatches("St. John's College", "St John's College")).toBe(true);
    });

    it('does not match a different school', () => {
        expect(slugMatches('Boston-University', 'Boston College')).toBe(false);
    });
});

describe('isUuid', () => {
    // Checked before slug resolution so pre-existing links keep working.
    it('accepts the Northeastern id that URLs used to carry', () => {
        expect(isUuid('38500bfc-e606-46a7-840d-720b11ad2e8b')).toBe(true);
    });

    it('rejects a slug', () => {
        expect(isUuid('Northeastern')).toBe(false);
        expect(isUuid('Boston-University')).toBe(false);
    });

    it('rejects junk', () => {
        expect(isUuid('')).toBe(false);
        expect(isUuid(null)).toBe(false);
        expect(isUuid(12345)).toBe(false);
    });

    // A slug can contain hyphens and hex, so the check has to be anchored and exact.
    it('rejects something merely uuid-shaped', () => {
        expect(isUuid('38500bfc-e606-46a7-840d-720b11ad2e8')).toBe(false);  // too short
        expect(isUuid('38500bfc-e606-46a7-840d-720b11ad2e8bb')).toBe(false); // too long
        expect(isUuid('zzzzzzzz-e606-46a7-840d-720b11ad2e8b')).toBe(false);  // non-hex
    });
});
