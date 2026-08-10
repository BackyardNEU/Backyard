import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const apiFetch = vi.fn();
const getUser = vi.fn();

vi.mock('../src/lib/api', () => ({ apiFetch: (...a) => apiFetch(...a) }));
vi.mock('../src/lib/supabase', () => ({ supabase: { auth: { getUser: (...a) => getUser(...a) } } }));

const { prefetchCalendar, readCalendar, invalidateCalendar } =
    await import('../src/lib/calendarCache.js');

const USER = 'user-1';
const EVENTS = [{ id: 'e1' }, { id: 'e2' }];
const RSVPS = [
    { user_id: USER, event_id: 'e1' },
    { user_id: 'someone-else', event_id: 'e2' },
];

describe('calendarCache', () => {
    beforeEach(() => {
        invalidateCalendar();
        apiFetch.mockReset();
        getUser.mockReset();
        getUser.mockResolvedValue({ data: { user: { id: USER } } });
        apiFetch.mockImplementation(async (path) => {
            if (path === '/events/weekly') return EVENTS;
            if (path.startsWith('/events/rsvps')) return RSVPS;
            return null;
        });
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

    it('returns the viewer, their events and the raw rsvp rows', async () => {
        const data = await prefetchCalendar();
        expect(data).toEqual({ userId: USER, events: EVENTS, rsvps: RSVPS });
    });

    // The original code awaited getUser before even starting the events request, though
    // neither depends on the other.
    it('runs the auth and weekly-events requests in parallel', async () => {
        let resolveAuth;
        getUser.mockReturnValue(new Promise((r) => { resolveAuth = r; }));

        const pending = prefetchCalendar();
        await Promise.resolve();

        // The events request must already be in flight while auth is still unresolved.
        expect(apiFetch).toHaveBeenCalledWith('/events/weekly');

        resolveAuth({ data: { user: { id: USER } } });
        await pending;
    });

    it('requests rsvps for exactly the returned event ids', async () => {
        await prefetchCalendar();
        expect(apiFetch).toHaveBeenCalledWith('/events/rsvps?eventIds=e1,e2');
    });

    it('skips the rsvp request when there are no events', async () => {
        apiFetch.mockImplementation(async (path) => (path === '/events/weekly' ? [] : null));
        const data = await prefetchCalendar();
        expect(data.rsvps).toEqual([]);
        expect(apiFetch).not.toHaveBeenCalledWith(expect.stringContaining('/events/rsvps'));
    });

    it('reports a signed-out viewer without fetching rsvps', async () => {
        getUser.mockResolvedValue({ data: { user: null } });
        const data = await prefetchCalendar();
        expect(data.userId).toBeNull();
        expect(apiFetch).not.toHaveBeenCalledWith(expect.stringContaining('/events/rsvps'));
    });

    it('dedupes concurrent calls', async () => {
        const [a, b] = await Promise.all([prefetchCalendar(), prefetchCalendar()]);
        expect(a).toBe(b);
        expect(getUser).toHaveBeenCalledOnce();
    });

    it('serves a later call from cache', async () => {
        await prefetchCalendar();
        apiFetch.mockClear();
        await prefetchCalendar();
        expect(apiFetch).not.toHaveBeenCalled();
    });

    it('readCalendar is null before a prefetch and populated after', async () => {
        expect(readCalendar()).toBeNull();
        await prefetchCalendar();
        expect(readCalendar()?.userId).toBe(USER);
    });

    it('expires after the TTL', async () => {
        vi.useFakeTimers();
        await prefetchCalendar();
        expect(readCalendar()).not.toBeNull();
        vi.advanceTimersByTime(31_000);
        expect(readCalendar()).toBeNull();
    });

    // AuthListener calls this on sign-in and sign-out, since the payload carries the
    // viewer's own RSVPs.
    it('invalidate clears the entry', async () => {
        await prefetchCalendar();
        invalidateCalendar();
        expect(readCalendar()).toBeNull();
    });
});
