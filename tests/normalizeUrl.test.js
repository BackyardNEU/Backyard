import { describe, it, expect } from 'vitest';
import {
    normalizeUrl,
    isValidLinkUrl,
    isValidUrl,
    validateBasicInfo,
} from '../shared/clubPageValidation.js';
import { sanitizeModules } from '../shared/sanitizeModules.js';

// A club reported their links being rejected. new URL() throws without a scheme, so
// validating raw input rejected every form anyone actually types and accepted only a
// pasted, fully-qualified address.

describe('normalizeUrl', () => {
    it('adds the scheme people leave off', () => {
        expect(normalizeUrl('instagram.com/neuchess')).toBe('https://instagram.com/neuchess');
        expect(normalizeUrl('www.instagram.com/neuchess')).toBe('https://www.instagram.com/neuchess');
    });

    it('leaves a complete URL alone apart from tidying', () => {
        expect(normalizeUrl('https://instagram.com/neuchess')).toBe('https://instagram.com/neuchess');
    });

    it('keeps http rather than forcing https on someone', () => {
        expect(normalizeUrl('http://example.com')).toBe('http://example.com/');
    });

    it('trims whitespace from a paste', () => {
        expect(normalizeUrl('  instagram.com/neuchess  ')).toBe('https://instagram.com/neuchess');
    });

    it('treats empty as empty rather than invalid', () => {
        expect(normalizeUrl('')).toBe('');
        expect(normalizeUrl('   ')).toBe('');
        expect(normalizeUrl(null)).toBe('');
    });

    // The scheme is only assumed when one is absent. Wrapping a dangerous scheme would
    // turn a rejection into something that looks safe.
    it('still rejects javascript: and data:', () => {
        expect(normalizeUrl('javascript:alert(1)')).toBeNull();
        expect(normalizeUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
        expect(normalizeUrl('vbscript:msgbox(1)')).toBeNull();
    });

    it('rejects other schemes that are not web links', () => {
        expect(normalizeUrl('mailto:a@b.com')).toBeNull();
        expect(normalizeUrl('ftp://example.com')).toBeNull();
    });

    // Without a dot in the host, "chess club" would become https://chess%20club and pass.
    it('rejects bare words that are not addresses', () => {
        expect(normalizeUrl('chess club')).toBeNull();
        expect(normalizeUrl('our instagram')).toBeNull();
        expect(normalizeUrl('@neuchess')).toBeNull();
    });
});

describe('isValidLinkUrl vs isValidUrl', () => {
    it('is lenient for typed links', () => {
        expect(isValidLinkUrl('instagram.com/neuchess')).toBe(true);
    });

    // Images keep the strict rule: a bare "example.com/a.png" in an <img src> resolves
    // as a path on our own domain and 404s.
    it('stays strict for image sources', () => {
        expect(isValidUrl('example.com/a.png')).toBe(false);
        expect(isValidUrl('https://example.com/a.png')).toBe(true);
    });
});

describe('validateBasicInfo links', () => {
    const base = { club_name: 'Chess', description: 'We play chess.' };

    it('accepts a link with no scheme, which is what clubs type', () => {
        expect(validateBasicInfo({
            ...base, links: [{ name: 'Instagram', url: 'instagram.com/neuchess' }],
        })).toBeNull();
    });

    it('still rejects a javascript: link', () => {
        expect(validateBasicInfo({
            ...base, links: [{ name: 'x', url: 'javascript:alert(1)' }],
        })).toMatch(/url/i);
    });

    it('still rejects something that is not an address at all', () => {
        expect(validateBasicInfo({
            ...base, links: [{ name: 'x', url: 'ask us on insta' }],
        })).toMatch(/url/i);
    });
});

describe('sanitizeModules link normalization', () => {
    // Stored verbatim, a scheme-less link in an href resolves as a path on our own site.
    it('stores links with the scheme filled in', () => {
        const out = sanitizeModules([
            { type: 'basic_info', data: { links: [{ name: 'Instagram', url: 'instagram.com/x' }] } },
        ]);
        expect(out[0].data.links[0].url).toBe('https://instagram.com/x');
    });

    it('normalizes the application link too', () => {
        const out = sanitizeModules([
            { type: 'join', data: { tabs: [], applicationLink: 'forms.gle/abc' } },
        ]);
        expect(out[0].data.applicationLink).toBe('https://forms.gle/abc');
    });

    // Discarding it would hide the problem; the validator should be the one to complain.
    it('leaves an unusable value alone for the validator to reject', () => {
        const out = sanitizeModules([
            { type: 'basic_info', data: { links: [{ name: 'x', url: 'javascript:alert(1)' }] } },
        ]);
        expect(out[0].data.links[0].url).toBe('javascript:alert(1)');
    });

    it('does not invent an application link where there was none', () => {
        const out = sanitizeModules([{ type: 'join', data: { tabs: [] } }]);
        expect(out[0].data.applicationLink).toBeUndefined();
    });
});
