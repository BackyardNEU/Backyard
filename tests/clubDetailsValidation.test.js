import { describe, it, expect } from 'vitest';
import {
    CLUB_DETAILS_WRITABLE,
    pickClubDetails,
    normalizeInstagram,
    validateClubDetails,
} from '../shared/clubDetailsValidation.js';

// demo_club_data.club_description / category / email / instagram had no write endpoint
// at all before the onboarding wizard. This is the allowlist that keeps the new one from
// becoming a mass-assignment hole, in the style of profiles.js pickWritable.

describe('CLUB_DETAILS_WRITABLE', () => {
    // Pinned deliberately. If someone widens this set, this test fails and they have to
    // think about why — which is the entire point of writing it down.
    it('is exactly the four intended fields', () => {
        expect([...CLUB_DETAILS_WRITABLE].sort()).toEqual([
            'category', 'club_description', 'email', 'instagram',
        ]);
    });

    // school is the exact-string join to uni_names.uni_name. Letting a club edit it would
    // move the club between universities and break every school-match check silently.
    it('excludes school, id, rating and the page-synced fields', () => {
        for (const forbidden of ['school', 'id', 'rating', 'university_id',
                                 'club_name', 'image_url', 'join_policy']) {
            expect(CLUB_DETAILS_WRITABLE.has(forbidden)).toBe(false);
        }
    });
});

describe('pickClubDetails', () => {
    it('keeps only allowlisted fields', () => {
        expect(pickClubDetails({ club_description: 'd', school: 'Harvard', id: 'x' }))
            .toEqual({ club_description: 'd' });
    });

    it('drops empty strings rather than blanking a column', () => {
        expect(pickClubDetails({ club_description: '   ', category: 'Sports' }))
            .toEqual({ category: 'Sports' });
    });

    it('returns an empty object for a body with nothing writable', () => {
        expect(pickClubDetails({ school: 'Harvard' })).toEqual({});
        expect(pickClubDetails(null)).toEqual({});
    });
});

describe('normalizeInstagram', () => {
    it('accepts a bare handle', () => {
        expect(normalizeInstagram('neuchess')).toBe('neuchess');
    });

    it('strips a leading @', () => {
        expect(normalizeInstagram('@neuchess')).toBe('neuchess');
    });

    it('extracts the handle from a profile URL', () => {
        expect(normalizeInstagram('https://instagram.com/neuchess')).toBe('neuchess');
        expect(normalizeInstagram('https://www.instagram.com/neuchess/')).toBe('neuchess');
    });

    it('returns null for something that is not a handle', () => {
        expect(normalizeInstagram('not a handle!')).toBeNull();
        expect(normalizeInstagram('')).toBeNull();
    });
});

describe('validateClubDetails', () => {
    it('accepts valid details', () => {
        expect(validateClubDetails({
            club_description: 'We play chess.',
            category: 'Games',
            email: 'chess@northeastern.edu',
            instagram: 'neuchess',
        })).toEqual({ valid: true, errors: [] });
    });

    it('rejects a malformed email', () => {
        const r = validateClubDetails({ email: 'not-an-email' });
        expect(r.valid).toBe(false);
        expect(r.errors[0].field).toBe('email');
    });

    it('caps description length', () => {
        expect(validateClubDetails({ club_description: 'x'.repeat(2001) }).valid).toBe(false);
    });

    it('rejects an unusable instagram value', () => {
        expect(validateClubDetails({ instagram: 'not a handle!' }).valid).toBe(false);
    });

    it('reports every problem, not just the first', () => {
        const r = validateClubDetails({ email: 'bad', instagram: 'also bad!' });
        expect(r.errors.length).toBe(2);
    });
});
