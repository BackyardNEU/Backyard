import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// dispatch's RETURN SHAPE is load-bearing and was pinned by nothing.
//
// clubPage.js's fan-out does `settled.filter((r) => r.ok)`. If dispatch ever resolves
// undefined again — which the original did on two paths — that throws a TypeError on
// every announcement, caught by the outer try, surfacing as "fan-out failed" for a
// fan-out that actually delivered fine. clubAnnounce.routes.test.js mocks this module
// wholesale, so the contract needs its own test.

const insert = vi.fn();
const decide = vi.fn();

vi.mock('./decisionLayer.js', () => ({
    decide: (...a) => decide(...a),
    WILDCARD_TYPE: '*',
}));

vi.mock('../supabaseAdmin.js', () => ({
    supabaseAdmin: { from: () => ({ insert: (...a) => insert(...a) }) },
}));

const { NotificationService } = await import('./service.js');

const event = {
    type: 'club_announcement',
    recipientId: 'member-1',
    actorId: 'sender-1',
    entity: { kind: 'club_announcement', id: 'ann-1' },
    payload: { clubId: 'club-1', message: 'hi' },
};

describe('NotificationService.dispatch', () => {
    beforeEach(() => {
        insert.mockReset();
        decide.mockReset();
        insert.mockResolvedValue({ error: null });
        decide.mockResolvedValue({ channels: ['in_app'] });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => vi.restoreAllMocks());

    it('returns { ok: true } after a successful insert', async () => {
        await expect(NotificationService.dispatch(event)).resolves.toEqual({ ok: true });
    });

    it('reports a skip without claiming success', async () => {
        decide.mockResolvedValue({ channels: [], skip: 'dedup' });

        const result = await NotificationService.dispatch(event);

        expect(result).toEqual({ ok: false, skipped: 'dedup' });
        expect(insert).not.toHaveBeenCalled();
    });

    // The skip log is what makes a suppressed friend_request diagnosable. Three of the
    // four callers discard the return value, so returning it is not a substitute.
    it('still logs a skip, not only returns it', async () => {
        decide.mockResolvedValue({ channels: [], skip: 'preference' });

        await NotificationService.dispatch(event);

        expect(console.log).toHaveBeenCalledWith('[notifications] skipping club_announcement: preference');
    });

    it('reports an insert failure instead of resolving as delivered', async () => {
        insert.mockResolvedValue({ error: { message: 'column "payload" does not exist', code: 'PGRST204' } });

        const result = await NotificationService.dispatch(event);

        expect(result.ok).toBe(false);
        expect(result.skipped).toBeUndefined();
        expect(result.error).toContain('payload');
    });

    it('never rejects, so one bad recipient cannot abort a fan-out', async () => {
        insert.mockRejectedValue(new Error('socket hang up'));
        await expect(NotificationService.dispatch(event)).resolves.toMatchObject({ ok: false });
    });

    it('reports an unknown type rather than resolving silently', async () => {
        const result = await NotificationService.dispatch({ ...event, type: 'not_a_real_type' });
        expect(result).toEqual({ ok: false, error: 'no handler for type not_a_real_type' });
    });

    // Every path must return an object. `undefined` would make clubPage.js's
    // `.filter((r) => r.ok)` throw on the whole fan-out.
    it('always resolves to an object with a boolean ok', async () => {
        const cases = [
            () => {},
            () => decide.mockResolvedValue({ channels: [], skip: 'dedup' }),
            () => insert.mockResolvedValue({ error: { message: 'x' } }),
            () => decide.mockRejectedValue(new Error('decide blew up')),
        ];
        for (const setup of cases) {
            setup();
            const r = await NotificationService.dispatch(event);
            expect(typeof r).toBe('object');
            expect(r).not.toBeNull();
            expect(typeof r.ok).toBe('boolean');
        }
    });

    it('skips the insert when in_app is not among the chosen channels', async () => {
        decide.mockResolvedValue({ channels: ['email'] });

        await expect(NotificationService.dispatch(event)).resolves.toEqual({ ok: true });
        expect(insert).not.toHaveBeenCalled();
    });
});

describe('clubAnnouncement buildRow', () => {
    it('writes the announcement id as the entity, not the club', async () => {
        const { buildRow } = await import('./handlers/clubAnnouncement.js');

        const row = buildRow(event);

        // entity_id is the dedup key in decisionLayer. Pointing it back at the club
        // collapsed every announcement a club sent into one five-minute bucket.
        expect(row.entity_id).toBe('ann-1');
        expect(row.entity_id).not.toBe(event.payload.clubId);
        expect(row.entity_type).toBe('club_announcement');
        expect(row).toMatchObject({
            recipient_id: 'member-1',
            actor_id: 'sender-1',
            type: 'club_announcement',
        });
        expect(row.payload.message).toBe('hi');
    });

    it('tolerates a missing entity rather than throwing', async () => {
        const { buildRow } = await import('./handlers/clubAnnouncement.js');
        expect(buildRow({ recipientId: 'r' }).entity_id).toBeNull();
    });
});
