import { describe, it, expect } from 'vitest';
import {
    LIMITS,
    isValidUrl,
    validateBasicInfo,
    validateJoin,
    validateStats,
    validateFaq,
    validateMemberRoster,
    validateClubMedia,
    validateModules,
} from '../shared/clubPageValidation.js';

// These rules lived only in src/uni_components/ExpandedTile.jsx, so PUT /clubs/:clubId/page
// enforced none of them — it checked Array.isArray(modules) and ran profanity checks, and
// that was all. Every length cap and URL check was bypassable with curl. Moving them to
// shared/ lets the server run the same rules the editor shows.

describe('isValidUrl', () => {
    it('accepts http and https', () => {
        expect(isValidUrl('http://a.com')).toBe(true);
        expect(isValidUrl('https://a.com')).toBe(true);
    });

    // javascript: URLs in a link would be an XSS vector wherever the href is rendered.
    it('rejects javascript: and other schemes', () => {
        expect(isValidUrl('javascript:alert(1)')).toBe(false);
        expect(isValidUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
        expect(isValidUrl('ftp://a.com')).toBe(false);
    });

    it('rejects garbage', () => {
        expect(isValidUrl('not a url')).toBe(false);
        expect(isValidUrl('')).toBe(false);
    });
});

describe('validateBasicInfo', () => {
    const ok = { club_name: 'Chess Club', description: 'We play chess.', links: [] };

    it('accepts a well-formed module', () => {
        expect(validateBasicInfo(ok)).toBeNull();
    });

    it('requires a club name', () => {
        expect(validateBasicInfo({ ...ok, club_name: '   ' })).toMatch(/name/i);
    });

    it('caps the club name length', () => {
        expect(validateBasicInfo({ ...ok, club_name: 'x'.repeat(81) })).toMatch(/80/);
    });

    it('requires a description', () => {
        expect(validateBasicInfo({ ...ok, description: '' })).toMatch(/description/i);
    });

    it('rejects an invalid link URL', () => {
        const bad = { ...ok, links: [{ name: 'site', url: 'javascript:alert(1)' }] };
        expect(validateBasicInfo(bad)).toMatch(/url/i);
    });
});

describe('validateJoin', () => {
    it('requires a title and body on every tab', () => {
        expect(validateJoin({ tabs: [{ title: '', body: 'x' }] })).toMatch(/title/i);
        expect(validateJoin({ tabs: [{ title: 't', body: '' }] })).toMatch(/body/i);
    });

    it('caps tab body length', () => {
        expect(validateJoin({ tabs: [{ title: 't', body: 'x'.repeat(501) }] })).toMatch(/500/);
    });
});

describe('validateStats', () => {
    it('rejects negative and fractional values', () => {
        expect(validateStats({ stats: [{ type: 'quantitative', value: -1, unit1: 'u' }] }))
            .toMatch(/negative/i);
        expect(validateStats({ stats: [{ type: 'quantitative', value: 1.5, unit1: 'u' }] }))
            .toMatch(/whole number/i);
    });

    it('rejects a qualitative value above its max', () => {
        expect(validateStats({ stats: [{ type: 'qualitative', label: 'l', value: 11, max: 10 }] }))
            .toMatch(/max/i);
    });
});

describe('validateFaq / validateMemberRoster / validateClubMedia', () => {
    it('requires a question on every FAQ', () => {
        expect(validateFaq({ faqs: [{ q: '', a: 'a' }] })).toMatch(/question/i);
    });

    // Bio length is measured on the text, not the markup, so formatting tags do not
    // eat a member's budget.
    it('measures member bio length with tags stripped', () => {
        const bio = `<b>${'x'.repeat(400)}</b>`;
        expect(validateMemberRoster({ members: [{ name: 'n', bio }] })).toBeNull();
    });

    it('caps poster title length', () => {
        expect(validateClubMedia({ posters: [{ poster_text: 'x'.repeat(101) }] })).toMatch(/100/);
    });
});

describe('validateModules — server entry point', () => {
    const basicInfo = {
        type: 'basic_info',
        order: 0,
        isDisplayed: true,
        data: { club_name: 'Chess', description: 'd', links: [] },
    };

    it('accepts a valid module array', () => {
        expect(validateModules([basicInfo])).toEqual({ valid: true, errors: [] });
    });

    it('rejects a non-array', () => {
        expect(validateModules('nope').valid).toBe(false);
        expect(validateModules(null).valid).toBe(false);
    });

    // Returns every violation rather than the first, so the wizard can highlight all
    // the steps that need attention instead of sending the user round one at a time.
    it('reports every violation, not just the first', () => {
        const result = validateModules([
            { type: 'basic_info', data: { club_name: '', description: '' } },
            { type: 'faqs', data: { faqs: [{ q: '' }] } },
        ]);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThanOrEqual(2);
        expect(result.errors.map((e) => e.module)).toContain('faqs');
    });

    it('rejects an unknown module type', () => {
        const result = validateModules([{ type: 'evil_module', data: {} }]);
        expect(result.valid).toBe(false);
        expect(result.errors[0].message).toMatch(/unknown/i);
    });

    // Without a count cap, a single request could store thousands of modules. Today the
    // only backstop is the global express.json 100kb limit, which surfaces as an opaque
    // 413 rather than a message anyone can act on.
    it('rejects more modules than the cap allows', () => {
        const many = Array.from({ length: LIMITS.MAX_MODULES + 1 }, () => ({
            type: 'faqs',
            data: { faqs: [] },
        }));
        expect(validateModules(many).valid).toBe(false);
    });

    it('rejects too many posters in one media module', () => {
        const posters = Array.from({ length: LIMITS.MAX_POSTERS + 1 }, () => ({ content: [] }));
        expect(validateModules([{ type: 'club_media', data: { posters } }]).valid).toBe(false);
    });

    it('rejects too many roster members', () => {
        const members = Array.from({ length: LIMITS.MAX_MEMBERS + 1 }, () => ({ name: 'n' }));
        expect(validateModules([{ type: 'member_roster', data: { members } }]).valid).toBe(false);
    });

    it('rejects a payload over the serialized size cap', () => {
        const huge = [{ type: 'faqs', data: { faqs: [{ q: 'q', a: 'x'.repeat(400_000) }] } }];
        const result = validateModules(huge);
        expect(result.valid).toBe(false);
        expect(JSON.stringify(result.errors)).toMatch(/large/i);
    });
});
