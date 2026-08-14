import { describe, it, expect } from 'vitest';
import { validateEvents, toEventRow, EVENT_LIMITS } from '../shared/clubEventsValidation.js';

// Mirrors validateEventFields in server/routes/events.js. If these drift, a club fills in
// events the wizard accepts and then approve fails on rows nobody can fix from the UI.

const hoursFromNow = (h) => new Date(Date.now() + h * 3600_000).toISOString();

const ok = () => ({
    event_name: 'First meeting',
    where: 'Curry 333',
    description: 'Come say hi.',
    start_time: hoursFromNow(24),
    end_time: hoursFromNow(25),
    is_members_only: false,
});

describe('validateEvents', () => {
    it('accepts no events at all, since the step is optional', () => {
        expect(validateEvents(undefined)).toEqual({ valid: true, errors: [] });
        expect(validateEvents([])).toEqual({ valid: true, errors: [] });
    });

    it('accepts a well-formed event', () => {
        expect(validateEvents([ok()])).toEqual({ valid: true, errors: [] });
    });

    it('requires a name', () => {
        expect(validateEvents([{ ...ok(), event_name: '  ' }]).valid).toBe(false);
    });

    it('requires both times', () => {
        expect(validateEvents([{ ...ok(), start_time: '' }]).valid).toBe(false);
        expect(validateEvents([{ ...ok(), end_time: '' }]).valid).toBe(false);
    });

    it('rejects an end before the start', () => {
        const r = validateEvents([{ ...ok(), start_time: hoursFromNow(25), end_time: hoursFromNow(24) }]);
        expect(r.valid).toBe(false);
        expect(r.errors[0].message).toMatch(/end after it starts/i);
    });

    // Matches the server's 12 hour ceiling.
    it('rejects an event longer than 12 hours', () => {
        const r = validateEvents([{ ...ok(), start_time: hoursFromNow(24), end_time: hoursFromNow(37) }]);
        expect(r.valid).toBe(false);
        expect(r.errors[0].message).toMatch(/12 hours/);
    });

    it('rejects an event that starts in the past', () => {
        const r = validateEvents([{ ...ok(), start_time: hoursFromNow(-2), end_time: hoursFromNow(-1) }]);
        expect(r.valid).toBe(false);
        expect(r.errors[0].message).toMatch(/past/i);
    });

    // A draft saved on Monday for a Tuesday event would otherwise start failing the
    // moment Tuesday passed, locking the club out over a field they already filled in.
    it('allows a past start while still drafting', () => {
        const r = validateEvents(
            [{ ...ok(), start_time: hoursFromNow(-2), end_time: hoursFromNow(-1) }],
            { partial: true }
        );
        expect(r.valid).toBe(true);
    });

    it('does not complain about empty fields while still drafting', () => {
        const r = validateEvents([{ event_name: '', start_time: '', end_time: '' }], { partial: true });
        expect(r.valid).toBe(true);
    });

    it('still enforces lengths while drafting', () => {
        const r = validateEvents([{ ...ok(), event_name: 'x'.repeat(200) }], { partial: true });
        expect(r.valid).toBe(false);
    });

    it('caps how many events one club can add here', () => {
        const many = Array.from({ length: EVENT_LIMITS.MAX_EVENTS + 1 }, ok);
        expect(validateEvents(many).valid).toBe(false);
    });

    it('reports which event failed', () => {
        const r = validateEvents([ok(), { ...ok(), event_name: '' }]);
        expect(r.errors[0].index).toBe(1);
    });

    it('rejects a non-array', () => {
        expect(validateEvents('nope').valid).toBe(false);
    });
});

describe('event poster', () => {
    it('accepts an uploaded poster URL', () => {
        expect(validateEvents([{ ...ok(), image_url: 'https://x.supabase.co/a.png' }]).valid).toBe(true);
    });

    it('accepts no poster at all, since it is optional', () => {
        expect(validateEvents([{ ...ok(), image_url: '' }]).valid).toBe(true);
    });

    // The column is rendered as an <img src>, so the same rule the club logo follows.
    it('rejects a javascript: poster address', () => {
        const r = validateEvents([{ ...ok(), image_url: 'javascript:alert(1)' }]);
        expect(r.valid).toBe(false);
        expect(r.errors[0].message).toMatch(/poster/i);
    });

    it('maps the poster onto the column club_events actually uses', () => {
        const row = toEventRow({ ...ok(), image_url: 'https://x/a.png' }, 'c', 'n');
        expect(row.event_image_url).toBe('https://x/a.png');
    });

    it('omits the column when there is no poster', () => {
        expect(toEventRow({ ...ok(), image_url: '' }, 'c', 'n').event_image_url).toBeUndefined();
    });
});

describe('toEventRow', () => {
    it('maps to the column names club_events actually uses', () => {
        const row = toEventRow(ok(), 'club-1', 'Chess Club');
        expect(row).toMatchObject({
            id_of_club: 'club-1',
            club_name: 'Chess Club',
            event_name: 'First meeting',
            where: 'Curry 333',
            event_description: 'Come say hi.',
            is_members_only: false,
        });
    });

    it('omits blank optional fields rather than writing empty strings', () => {
        const row = toEventRow({ ...ok(), where: '', description: '' }, 'c', 'n');
        expect(row.where).toBeUndefined();
        expect(row.event_description).toBeNull();
    });

    it('coerces members-only to a real boolean', () => {
        expect(toEventRow({ ...ok(), is_members_only: 'yes' }, 'c', 'n').is_members_only).toBe(false);
        expect(toEventRow({ ...ok(), is_members_only: true }, 'c', 'n').is_members_only).toBe(true);
    });
});
