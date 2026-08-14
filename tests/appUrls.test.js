import { describe, it, expect } from 'vitest';
import { parseAppUrls, buildInviteUrl, buildOnboardingUrl } from '../server/lib/appUrls.js';

// FRONTEND_URL is a comma-separated CORS allowlist, but invites.js interpolated it whole
// into invite links. The moment a second origin was added — which deploying the club
// onboarding wizard requires — every generated link became
// "https://a.com,https://b.com/join/<token>". parseAppUrls exists to keep the allowlist
// and the single-origin link bases from ever being the same value again.

describe('parseAppUrls — allowedOrigins', () => {
    it('splits a comma-separated allowlist', () => {
        const { allowedOrigins } = parseAppUrls({
            FRONTEND_URL: 'https://a.com,https://b.com',
        });
        expect(allowedOrigins).toEqual(['https://a.com', 'https://b.com']);
    });

    it('trims whitespace around each origin', () => {
        const { allowedOrigins } = parseAppUrls({
            FRONTEND_URL: 'https://a.com ,  https://b.com',
        });
        expect(allowedOrigins).toEqual(['https://a.com', 'https://b.com']);
    });

    it('drops empty entries from a trailing comma', () => {
        const { allowedOrigins } = parseAppUrls({ FRONTEND_URL: 'https://a.com,' });
        expect(allowedOrigins).toEqual(['https://a.com']);
    });

    it('defaults to the Vite dev origin when unset', () => {
        expect(parseAppUrls({}).allowedOrigins).toEqual(['http://localhost:5173']);
    });
});

describe('parseAppUrls — publicAppUrl', () => {
    it('uses PUBLIC_APP_URL when set', () => {
        const { publicAppUrl } = parseAppUrls({
            FRONTEND_URL: 'https://a.com,https://b.com',
            PUBLIC_APP_URL: 'https://canonical.com',
        });
        expect(publicAppUrl).toBe('https://canonical.com');
    });

    // The fallback takes the FIRST origin, never the raw string. This is the specific
    // step that stops a multi-origin allowlist from leaking into a link.
    it('falls back to the first allowed origin, not the whole allowlist', () => {
        const { publicAppUrl } = parseAppUrls({
            FRONTEND_URL: 'https://a.com,https://b.com',
        });
        expect(publicAppUrl).toBe('https://a.com');
    });

    it('strips a trailing slash so joining a path cannot double up', () => {
        const { publicAppUrl } = parseAppUrls({ PUBLIC_APP_URL: 'https://a.com/' });
        expect(publicAppUrl).toBe('https://a.com');
    });
});

describe('parseAppUrls — validation', () => {
    // Fail at boot rather than mint 150 broken links into a CSV that then gets pasted
    // into 150 outreach DMs.
    it('throws when a single-origin var contains a comma', () => {
        expect(() =>
            parseAppUrls({ PUBLIC_APP_URL: 'https://a.com,https://b.com' })
        ).toThrow(/PUBLIC_APP_URL/);
    });

    it('throws when ONBOARD_URL contains a comma', () => {
        expect(() =>
            parseAppUrls({ ONBOARD_URL: 'https://a.com,https://b.com' })
        ).toThrow(/ONBOARD_URL/);
    });

    it('throws on a non-http scheme', () => {
        expect(() => parseAppUrls({ PUBLIC_APP_URL: 'ftp://a.com' })).toThrow(/http/);
    });

    it('throws on an unparseable URL', () => {
        expect(() => parseAppUrls({ PUBLIC_APP_URL: 'not a url' })).toThrow();
    });

    it('names the offending variable in the error', () => {
        expect(() => parseAppUrls({ ONBOARD_URL: 'nonsense' })).toThrow(/ONBOARD_URL/);
    });
});

describe('parseAppUrls — onboardUrl', () => {
    it('uses ONBOARD_URL when set', () => {
        const { onboardUrl } = parseAppUrls({
            PUBLIC_APP_URL: 'https://app.com',
            ONBOARD_URL: 'https://clubs.com',
        });
        expect(onboardUrl).toBe('https://clubs.com');
    });

    // No fallback on purpose. The main app has no /claim route and no catch-all, so
    // borrowing its origin would mint outreach links that render a blank page.
    it('is null when unset, rather than borrowing the app origin', () => {
        const { onboardUrl } = parseAppUrls({ PUBLIC_APP_URL: 'https://app.com' });
        expect(onboardUrl).toBeNull();
    });

    it('refuses to build a claim URL when unset', async () => {
        const { onboardingUrl } = await import('../server/lib/appUrls.js');
        // The module-level ONBOARD_URL is unset in the test environment.
        expect(() => onboardingUrl('abc')).toThrow(/ONBOARD_URL/);
    });
});

describe('link builders', () => {
    it('builds an invite URL', () => {
        expect(buildInviteUrl('https://a.com', 'abc123')).toBe('https://a.com/join/abc123');
    });

    it('builds an onboarding claim URL', () => {
        expect(buildOnboardingUrl('https://clubs.com', 'abc123')).toBe(
            'https://clubs.com/claim/abc123'
        );
    });

    // The regression test for the bug this module exists to fix.
    it('produces a well-formed invite URL when the allowlist has several origins', () => {
        const { publicAppUrl } = parseAppUrls({
            FRONTEND_URL: 'https://app.com,https://clubs.app.com',
        });
        const url = buildInviteUrl(publicAppUrl, 'tok');
        expect(url).toBe('https://app.com/join/tok');
        expect(url).not.toContain(',');
    });

    it('percent-encodes a token so it cannot inject path segments', () => {
        expect(buildInviteUrl('https://a.com', 'a/../b')).toBe('https://a.com/join/a%2F..%2Fb');
    });
});
