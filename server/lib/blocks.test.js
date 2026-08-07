import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture the .or() filter string each call builds, so we can assert both the mutual
// union logic and that untrusted input never reaches it.
const orMock = vi.fn();
const limitMock = vi.fn();

vi.mock('../supabaseAdmin.js', () => {
    const select = vi.fn(() => ({
        or: (filter) => {
            orMock(filter);
            const result = limitMock.getMockImplementation() || limitMock;
            return Object.assign(Promise.resolve(result()), { limit: () => Promise.resolve(result()) });
        },
    }));
    return { supabaseAdmin: { from: vi.fn(() => ({ select })) } };
});

const { getBlockedIds, isBlockedBetween, filterBlocked, isUuid } = await import('./blocks.js');

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const CAROL = '33333333-3333-4333-8333-333333333333';

describe('isUuid', () => {
    it('accepts a well-formed uuid', () => {
        expect(isUuid(ALICE)).toBe(true);
    });

    it('rejects filter-injection attempts and other junk', () => {
        expect(isUuid(`${ALICE},blocker_id.eq.${BOB}`)).toBe(false);
        expect(isUuid('not-a-uuid')).toBe(false);
        expect(isUuid('')).toBe(false);
        expect(isUuid(null)).toBe(false);
        expect(isUuid(undefined)).toBe(false);
        expect(isUuid(12345)).toBe(false);
    });
});

describe('getBlockedIds', () => {
    beforeEach(() => {
        orMock.mockReset();
        limitMock.mockReset();
    });

    // The union across both columns is what makes blocking mutual.
    it('returns people the user blocked AND people who blocked the user', () => {
        limitMock.mockImplementation(() => ({
            data: [
                { blocker_id: ALICE, blocked_id: BOB },   // alice blocked bob
                { blocker_id: CAROL, blocked_id: ALICE }, // carol blocked alice
            ],
            error: null,
        }));

        return getBlockedIds(ALICE).then((ids) => {
            expect(ids).toBeInstanceOf(Set);
            expect([...ids].sort()).toEqual([BOB, CAROL].sort());
        });
    });

    it('returns an empty set when there are no blocks', async () => {
        limitMock.mockImplementation(() => ({ data: [], error: null }));
        expect((await getBlockedIds(ALICE)).size).toBe(0);
    });

    // A moderation outage should not take down every read path that calls this.
    it('fails soft to an empty set on a database error', async () => {
        limitMock.mockImplementation(() => ({ data: null, error: { message: 'boom' } }));
        expect((await getBlockedIds(ALICE)).size).toBe(0);
    });

    it('never queries with a non-uuid id', async () => {
        expect((await getBlockedIds('bogus')).size).toBe(0);
        expect((await getBlockedIds(null)).size).toBe(0);
        expect(orMock).not.toHaveBeenCalled();
    });
});

describe('isBlockedBetween', () => {
    beforeEach(() => {
        orMock.mockReset();
        limitMock.mockReset();
        limitMock.mockImplementation(() => ({ data: [], error: null }));
    });

    it('is true when a row exists in either direction', async () => {
        limitMock.mockImplementation(() => ({ data: [{ id: 'row' }], error: null }));
        expect(await isBlockedBetween(ALICE, BOB)).toBe(true);
    });

    it('is false when no row exists', async () => {
        expect(await isBlockedBetween(ALICE, BOB)).toBe(false);
    });

    it('is false for a user against themselves', async () => {
        expect(await isBlockedBetween(ALICE, ALICE)).toBe(false);
        expect(orMock).not.toHaveBeenCalled();
    });

    // req.params.id reaches this function, so a crafted value must not be able to extend
    // the PostgREST filter expression.
    it('refuses to build a filter from untrusted non-uuid input', async () => {
        const injection = `${BOB},blocked_id.eq.${CAROL}`;
        expect(await isBlockedBetween(ALICE, injection)).toBe(false);
        expect(orMock).not.toHaveBeenCalled();
    });

    it('only interpolates values it has validated as uuids', async () => {
        await isBlockedBetween(ALICE, BOB);
        expect(orMock).toHaveBeenCalledOnce();
        const filter = orMock.mock.calls[0][0];
        // Every id appearing in the filter must be one of the two validated uuids.
        for (const match of filter.matchAll(/[0-9a-f-]{36}/gi)) {
            expect([ALICE, BOB]).toContain(match[0]);
        }
    });

    it('fails soft to false on a database error', async () => {
        limitMock.mockImplementation(() => ({ data: null, error: { message: 'boom' } }));
        expect(await isBlockedBetween(ALICE, BOB)).toBe(false);
    });
});

describe('filterBlocked', () => {
    it('removes rows whose id is blocked', () => {
        const rows = [{ id: ALICE }, { id: BOB }, { id: CAROL }];
        expect(filterBlocked(rows, new Set([BOB]))).toEqual([{ id: ALICE }, { id: CAROL }]);
    });

    it('supports a custom id accessor for join rows', () => {
        const rows = [
            { user_id: ALICE, event_id: 'e1' },
            { user_id: BOB, event_id: 'e1' },
        ];
        expect(filterBlocked(rows, new Set([BOB]), (r) => r.user_id)).toEqual([
            { user_id: ALICE, event_id: 'e1' },
        ]);
    });

    it('is a no-op when nothing is blocked', () => {
        const rows = [{ id: ALICE }];
        expect(filterBlocked(rows, new Set())).toBe(rows);
    });

    it('handles null rows', () => {
        expect(filterBlocked(null, new Set([BOB]))).toEqual([]);
    });
});
