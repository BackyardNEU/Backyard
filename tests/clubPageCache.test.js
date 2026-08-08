import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const apiFetch = vi.fn();
vi.mock('../src/lib/api', () => ({ apiFetch: (...a) => apiFetch(...a) }));

const { prefetchClubPage, readClubPage, invalidateClubPage } = await import('../src/lib/clubPageCache.js');

const CLUB = 'club-1';

describe('clubPageCache', () => {
    beforeEach(() => {
        apiFetch.mockReset();
        apiFetch.mockImplementation(async (path) => ({ path }));
        invalidateClubPage(CLUB);
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

    it('fetches the five public endpoints', async () => {
        await prefetchClubPage(CLUB);
        expect(apiFetch).toHaveBeenCalledTimes(5);
        const paths = apiFetch.mock.calls.map((c) => c[0]);
        expect(paths).toEqual([
            `/clubs/${CLUB}/reviews`,
            `/clubs/${CLUB}/page`,
            `/clubs/${CLUB}/top-tags`,
            `/clubs/${CLUB}/events/upcoming`,
            `/clubs/${CLUB}/members`,
        ]);
    });

    // Repeated hovers over one card must not re-issue the whole batch.
    it('dedupes concurrent calls into one in-flight request', async () => {
        const [a, b, c] = await Promise.all([
            prefetchClubPage(CLUB), prefetchClubPage(CLUB), prefetchClubPage(CLUB),
        ]);
        expect(apiFetch).toHaveBeenCalledTimes(5);
        expect(a).toBe(b);
        expect(b).toBe(c);
    });

    it('serves a later call from cache without refetching', async () => {
        await prefetchClubPage(CLUB);
        apiFetch.mockClear();
        await prefetchClubPage(CLUB);
        expect(apiFetch).not.toHaveBeenCalled();
    });

    it('readClubPage returns the payload synchronously after a prefetch', async () => {
        expect(readClubPage(CLUB)).toBeNull();
        await prefetchClubPage(CLUB);
        expect(readClubPage(CLUB)).toMatchObject({ page: { path: `/clubs/${CLUB}/page` } });
    });

    // A club with no page row or no reviews must still open.
    it('tolerates individual endpoints failing', async () => {
        apiFetch.mockImplementation(async (path) => {
            if (path.endsWith('/page')) throw new Error('no page row');
            return { path };
        });
        const data = await prefetchClubPage(CLUB);
        expect(data.page).toBeUndefined();
        expect(data.reviews).toBeDefined();
    });

    it('expires after the TTL', async () => {
        vi.useFakeTimers();
        await prefetchClubPage(CLUB);
        expect(readClubPage(CLUB)).not.toBeNull();
        vi.advanceTimersByTime(61_000);
        expect(readClubPage(CLUB)).toBeNull();
    });

    it('invalidate drops the entry so an edit is not served stale', async () => {
        await prefetchClubPage(CLUB);
        invalidateClubPage(CLUB);
        expect(readClubPage(CLUB)).toBeNull();
        apiFetch.mockClear();
        await prefetchClubPage(CLUB);
        expect(apiFetch).toHaveBeenCalledTimes(5);
    });

    it('ignores a missing club id', async () => {
        expect(await prefetchClubPage(undefined)).toBeNull();
        expect(apiFetch).not.toHaveBeenCalled();
    });
});
