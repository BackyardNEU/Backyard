import { describe, it, expect, vi } from 'vitest';

// lucide-react exports React components; in a node test environment we only
// care that the registry uses them as icon references, not that they render.
vi.mock('lucide-react', () => ({
    UserPlus: 'UserPlus',
    UserCheck: 'UserCheck',
    CalendarPlus: 'CalendarPlus',
    Star: 'Star',
    Megaphone: 'Megaphone',
}));

const { registry } = await import('../src/notifications/registry.js');

// ─── Shared fixture builders ──────────────────────────────────────────────────
const announcement = (overrides = {}) => ({
    type: 'club_announcement',
    payload: {
        clubId: 'club-1',
        clubName: 'Chess Club',
        uniId:   'uni-1',
        message: 'Meeting at 7pm',
        title:   null,
        ...overrides,
    },
    actor: null,
    entity_id: 'announce-uuid',
    read_at: null,
    created_at: new Date().toISOString(),
});

describe('club_announcement registry entry', () => {
    it('formats message as "ClubName: body" when no title is set', () => {
        const n = announcement({ title: null });
        expect(registry.club_announcement.message(n)).toBe('Chess Club: Meeting at 7pm');
    });

    it('formats message as "ClubName — Title: body" when title is present', () => {
        const n = announcement({ title: 'Urgent' });
        expect(registry.club_announcement.message(n)).toBe('Chess Club — Urgent: Meeting at 7pm');
    });

    it('falls back to "A club" when clubName is absent', () => {
        const n = announcement({ clubName: undefined, title: null });
        expect(registry.club_announcement.message(n)).toMatch(/^A club:/);
    });

    it('getUrl returns /university/:uniId?club=:clubId when both are present', () => {
        const n = announcement();
        expect(registry.club_announcement.getUrl(n)).toBe('/university/uni-1?club=club-1');
    });

    it('getUrl returns /university/:uniId without ?club= when clubId is absent', () => {
        const n = announcement({ clubId: undefined });
        expect(registry.club_announcement.getUrl(n)).toBe('/university/uni-1');
    });

    it('getUrl returns null when uniId is absent', () => {
        const n = announcement({ uniId: undefined });
        expect(registry.club_announcement.getUrl(n)).toBeNull();
    });

    it('image() returns the club imageUrl from payload', () => {
        const n = { ...announcement(), payload: { ...announcement().payload, imageUrl: '/logo.png' } };
        expect(registry.club_announcement.image(n)).toBe('/logo.png');
    });

    it('image() returns null when imageUrl is absent', () => {
        const n = announcement();
        expect(registry.club_announcement.image(n)).toBeNull();
    });
});
