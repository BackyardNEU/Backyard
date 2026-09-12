import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Supabase mock ────────────────────────────────────────────────────────────
const insertResult = vi.fn();
vi.mock('../supabaseAdmin.js', () => ({
    supabaseAdmin: {
        from: () => ({
            insert: (row) => {
                insertResult._lastRow = row;
                return Promise.resolve(insertResult());
            },
        }),
    },
}));

// ─── decisionLayer mock ───────────────────────────────────────────────────────
const decideMock = vi.fn();
vi.mock('./decisionLayer.js', () => ({ decide: decideMock }));

// ─── Handler mock ─────────────────────────────────────────────────────────────
vi.mock('./handlers/friendRequest.js',    () => ({ buildRow: (e) => ({ recipient_id: e.recipientId, type: 'friend_request',    entity_id: e.entity?.id ?? null, payload: null }), emailTemplate: null }));
vi.mock('./handlers/clubAnnouncement.js', () => ({ buildRow: (e) => ({ recipient_id: e.recipientId, type: 'club_announcement', entity_id: e.entity?.id ?? null, payload: e.payload ?? null }), emailTemplate: null }));

const { NotificationService } = await import('./service.js');

const event = {
    type: 'friend_request',
    recipientId: 'user-1',
    actorId: 'user-2',
    entity: { kind: 'user', id: 'req-1' },
};

const announceEvent = {
    type: 'club_announcement',
    recipientId: 'member-1',
    actorId: 'mod-1',
    entity: { kind: 'announcement', id: 'announce-uuid' },
    payload: { clubId: 'club-1', clubName: 'Chess', message: 'Hello!' },
};

beforeEach(() => {
    decideMock.mockReset();
    insertResult.mockReset();
    decideMock.mockResolvedValue({ channels: ['in_app', 'email', 'push'] });
    insertResult.mockReturnValue({ data: {}, error: null });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('NotificationService.dispatch()', () => {
    it('returns { ok: true } on successful in_app delivery', async () => {
        const result = await NotificationService.dispatch(event);
        expect(result).toEqual({ ok: true });
    });

    it('returns { skipped: reason } when decide() deduplicates', async () => {
        decideMock.mockResolvedValue({ channels: [], skip: 'dedup' });
        const result = await NotificationService.dispatch(event);
        expect(result).toEqual({ skipped: 'dedup' });
    });

    it('still logs the skip to console when dedup fires', async () => {
        decideMock.mockResolvedValue({ channels: [], skip: 'dedup' });
        await NotificationService.dispatch(event);
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('skipping'));
    });

    it('returns { error: message } when the insert fails', async () => {
        insertResult.mockReturnValue({ error: { message: 'column payload does not exist' } });
        const result = await NotificationService.dispatch(event);
        expect(result.error).toMatch(/column payload/);
    });

    it('logs insert failures to console', async () => {
        insertResult.mockReturnValue({ error: { message: 'db error' } });
        await NotificationService.dispatch(event);
        expect(console.error).toHaveBeenCalled();
    });

    it('returns { error } for an unknown type without throwing', async () => {
        const result = await NotificationService.dispatch({ ...event, type: 'does_not_exist' });
        expect(result.error).toBeDefined();
    });

    it('passes payload through to the inserted row for club_announcement', async () => {
        await NotificationService.dispatch(announceEvent);
        const row = insertResult._lastRow;
        expect(row.payload).toMatchObject({ clubId: 'club-1', message: 'Hello!' });
    });

    it('inserts a fresh UUID for every dispatch call', async () => {
        await NotificationService.dispatch(event);
        const id1 = insertResult._lastRow.id;
        await NotificationService.dispatch(event);
        const id2 = insertResult._lastRow.id;
        expect(id1).not.toBe(id2);
    });

    it('does not insert when the in_app channel is absent', async () => {
        decideMock.mockResolvedValue({ channels: ['email', 'push'] });
        await NotificationService.dispatch(event);
        expect(insertResult).not.toHaveBeenCalled();
    });

    it('returns { ok: true } even when no channels are enabled but skip is not set', async () => {
        decideMock.mockResolvedValue({ channels: [] });
        const result = await NotificationService.dispatch(event);
        expect(result).toEqual({ ok: true });
    });
});
