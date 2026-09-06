import { describe, it, expect } from 'vitest';
import { mintToken, hashToken, tokenPrefix } from '../server/lib/inviteTokens.js';

// Tokens are stored as SHA-256 rather than plaintext. The threat is not brute force —
// 256 bits from crypto.randomBytes settles that — it is that club_invite_links is
// reachable through PostgREST with the anon key that ships in the browser bundle. A
// missing RLS policy should not hand out club admin on every club.

describe('mintToken', () => {
    it('produces 64 hex characters (256 bits)', () => {
        const t = mintToken();
        expect(t).toMatch(/^[0-9a-f]{64}$/);
    });

    it('does not repeat', () => {
        const seen = new Set(Array.from({ length: 200 }, () => mintToken()));
        expect(seen.size).toBe(200);
    });
});

describe('hashToken', () => {
    it('is deterministic, so a lookup by hash finds the row', () => {
        expect(hashToken('abc')).toBe(hashToken('abc'));
    });

    it('differs for different tokens', () => {
        expect(hashToken('abc')).not.toBe(hashToken('abd'));
    });

    it('produces a 64-char hex digest', () => {
        expect(hashToken(mintToken())).toMatch(/^[0-9a-f]{64}$/);
    });

    // Unsalted on purpose: a per-row salt would force a table scan on every lookup, and
    // the high-entropy input makes rainbow tables meaningless.
    it('is unsalted, so the same token always maps to the same row', () => {
        const t = mintToken();
        expect(hashToken(t)).toBe(hashToken(t));
    });

    it('never returns the token itself', () => {
        const t = mintToken();
        expect(hashToken(t)).not.toBe(t);
    });

    it('rejects an empty token rather than hashing nothing', () => {
        expect(() => hashToken('')).toThrow();
        expect(() => hashToken(null)).toThrow();
    });
});

describe('tokenPrefix', () => {
    // Stored in the clear so a CSV row can be matched back to a DB row during outreach.
    // 8 hex chars leaks 32 bits, leaving 224 — not a meaningful reduction.
    it('is the first 8 characters', () => {
        expect(tokenPrefix('abcdef0123456789')).toBe('abcdef01');
    });

    it('is short enough not to weaken the token', () => {
        expect(tokenPrefix(mintToken())).toHaveLength(8);
    });
});
