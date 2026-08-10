import { describe, it, expect, vi, beforeEach } from 'vitest';

// decide() makes two queries: a dedup lookup on `notifications`, then a preference lookup
// on `notification_preferences`. Each mock returns a thenable so the route can await it.
const dedupResult = vi.fn();
const prefsResult = vi.fn();

vi.mock('../supabaseAdmin.js', () => {
    const from = (table) => {
        if (table === 'notifications') {
            const chain = {
                select: () => chain,
                eq: () => chain,
                gte: () => chain,
                limit: () => Promise.resolve(dedupResult()),
            };
            return chain;
        }
        // notification_preferences
        const chain = {
            select: () => chain,
            eq: () => chain,
            in: () => Promise.resolve(prefsResult()),
        };
        return chain;
    };
    return { supabaseAdmin: { from } };
});

const { decide, WILDCARD_TYPE } = await import('./decisionLayer.js');

const event = { type: 'friend_request', recipientId: 'user-1', entity: { id: 'req-1' } };

describe('decide()', () => {
    beforeEach(() => {
        dedupResult.mockReset();
        prefsResult.mockReset();
        dedupResult.mockReturnValue({ data: [], error: null });
        prefsResult.mockReturnValue({ data: [], error: null });
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('enables every channel when the user has no preference rows', async () => {
        const r = await decide(event);
        expect(r.channels).toEqual(['in_app', 'email', 'push']);
    });

    it('skips when an identical notification was sent recently', async () => {
        dedupResult.mockReturnValue({ data: [{ id: 'n1' }], error: null });
        expect(await decide(event)).toEqual({ channels: [], skip: 'dedup' });
    });

    // The reason the wildcard exists: the settings page writes per-channel master toggles,
    // and a row per known type would not cover types added later.
    it('honours a wildcard row across every type', async () => {
        prefsResult.mockReturnValue({
            data: [{ type: WILDCARD_TYPE, channel: 'email', enabled: false }],
            error: null,
        });

        const r = await decide(event);
        expect(r.channels).toEqual(['in_app', 'push']);
    });

    it('applies the wildcard to a type that has no rows of its own', async () => {
        prefsResult.mockReturnValue({
            data: [{ type: WILDCARD_TYPE, channel: 'email', enabled: false }],
            error: null,
        });

        const r = await decide({ ...event, type: 'some_future_type' });
        expect(r.channels).not.toContain('email');
    });

    it('still honours a row for the specific type', async () => {
        prefsResult.mockReturnValue({
            data: [{ type: 'friend_request', channel: 'in_app', enabled: false }],
            error: null,
        });

        const r = await decide(event);
        expect(r.channels).toEqual(['email', 'push']);
    });

    // Leaves room for per-type toggles later without a schema change.
    it('lets a specific-type row re-enable what the wildcard disabled', async () => {
        prefsResult.mockReturnValue({
            data: [
                { type: WILDCARD_TYPE, channel: 'email', enabled: false },
                { type: 'friend_request', channel: 'email', enabled: true },
            ],
            error: null,
        });

        const r = await decide(event);
        expect(r.channels).toContain('email');
    });

    it('lets a specific-type row disable what the wildcard left on', async () => {
        prefsResult.mockReturnValue({
            data: [
                { type: WILDCARD_TYPE, channel: 'email', enabled: true },
                { type: 'friend_request', channel: 'email', enabled: false },
            ],
            error: null,
        });

        const r = await decide(event);
        expect(r.channels).not.toContain('email');
    });

    it('disables multiple channels at once', async () => {
        prefsResult.mockReturnValue({
            data: [
                { type: WILDCARD_TYPE, channel: 'email', enabled: false },
                { type: WILDCARD_TYPE, channel: 'push', enabled: false },
            ],
            error: null,
        });

        expect((await decide(event)).channels).toEqual(['in_app']);
    });

    // Previously only { data } was destructured, so a missing table looked identical to
    // "no overrides" and nothing surfaced. It should still fail open, but say so.
    it('fails open and logs when the preference lookup errors', async () => {
        prefsResult.mockReturnValue({ data: null, error: { message: 'relation does not exist' } });

        const r = await decide(event);
        expect(r.channels).toEqual(['in_app', 'email', 'push']);
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('preference lookup failed'),
            expect.stringContaining('relation does not exist')
        );
    });
});
