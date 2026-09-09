import { describe, it, expect } from 'vitest';
import { describeInviteError } from '../src/lib/inviteLinkError.js';

// Both invite screens used to render one message for every failure. ClaimGate's said
// "It may have expired or been replaced" — so a CORS rejection, a dead API, or a typo in
// the URL all told the club their link had expired. It sent them back to us for a fresh
// link that would have failed in exactly the same way.
describe('describeInviteError', () => {
    it('says the link is unrecognised on a 404, and does not claim it expired', () => {
        const { title, body } = describeInviteError({ status: 404 });
        expect(body).not.toMatch(/expired/i);
        expect(`${title} ${body}`).toMatch(/recognise|recognize/i);
    });

    it('says expired or replaced only on a 410', () => {
        const { body } = describeInviteError({ status: 410 });
        expect(body).toMatch(/expired|replaced/i);
    });

    // The one that caused the outage: no status means the request never got an HTTP
    // answer — CORS, DNS, offline, API down. Nothing is known about the link itself.
    it('blames the connection, not the link, when there is no status', () => {
        for (const err of [new TypeError('Failed to fetch'), {}, null, undefined]) {
            const { body, retryable } = describeInviteError(err);
            expect(body).not.toMatch(/expired|replaced/i);
            expect(retryable).toBe(true);
        }
    });

    it('treats a 5xx as our problem rather than the link expiring', () => {
        const { body, retryable } = describeInviteError({ status: 502 });
        expect(body).not.toMatch(/expired|replaced/i);
        expect(retryable).toBe(true);
    });

    // 404 and 410 are verdicts about the link — retrying the same URL cannot change them.
    it('marks link verdicts as not retryable', () => {
        expect(describeInviteError({ status: 404 }).retryable).toBe(false);
        expect(describeInviteError({ status: 410 }).retryable).toBe(false);
    });

    it('always returns a non-empty title and body', () => {
        for (const status of [400, 401, 403, 404, 410, 429, 500, 502, undefined]) {
            const { title, body } = describeInviteError({ status });
            expect(title.length).toBeGreaterThan(0);
            expect(body.length).toBeGreaterThan(0);
        }
    });

    // Rate limiting is worth naming: the advice is "wait", which is different from both
    // "your link is dead" and "we can't reach the server".
    it('names rate limiting on a 429', () => {
        const { body, retryable } = describeInviteError({ status: 429 });
        expect(body).toMatch(/too many|moment|wait/i);
        expect(retryable).toBe(true);
    });
});
