// Validation for events collected during club onboarding.
//
// Mirrors validateEventFields in server/routes/events.js so the wizard cannot accept
// something the events API would reject later. The rules there are the source of truth:
// 12 hour maximum, no start in the past, 200 character description.
//
// The wizard stages events in the draft rather than creating them immediately. Nothing a
// club types is public before review, and an event row would be visible on the calendar
// the moment it existed.

import { isSafeImageRef } from './clubPageValidation.js';

export const EVENT_LIMITS = {
    NAME_MAX: 80,
    WHERE_MAX: 120,
    DESCRIPTION_MAX: 200,
    MAX_EVENTS: 10,
    MAX_HOURS: 12,
};

const HOUR_MS = 60 * 60 * 1000;

/**
 * @param {unknown} events
 * @param {{ partial?: boolean }} opts partial skips "you have not filled this in yet"
 *        checks, for autosaves fired mid-typing.
 * @returns {{ valid: boolean, errors: Array<{ index: number, message: string }> }}
 */
export function validateEvents(events, { partial = false } = {}) {
    const errors = [];

    if (events == null) return { valid: true, errors };
    if (!Array.isArray(events)) {
        return { valid: false, errors: [{ index: -1, message: 'Events must be a list.' }] };
    }
    if (events.length > EVENT_LIMITS.MAX_EVENTS) {
        errors.push({ index: -1, message: `You can add up to ${EVENT_LIMITS.MAX_EVENTS} events here.` });
    }

    events.forEach((ev, index) => {
        const add = (message) => errors.push({ index, message });
        const name = (ev?.event_name ?? '').trim();
        const where = (ev?.where ?? '').trim();
        const description = (ev?.description ?? '').trim();

        if (!partial && !name) add('Every event needs a name.');
        if (name.length > EVENT_LIMITS.NAME_MAX) add('Event names must be 80 characters or fewer.');
        if (where.length > EVENT_LIMITS.WHERE_MAX) add('Location must be 120 characters or fewer.');
        if (description.length > EVENT_LIMITS.DESCRIPTION_MAX) {
            add('Event description must be 200 characters or fewer.');
        }

        // Same rule the page logo follows: a same-origin path or an http(s) URL, which
        // keeps javascript: and data: out of a column that is rendered as an <img src>.
        const image = (ev?.image_url ?? '').trim();
        if (image && !isSafeImageRef(image)) add('That poster address is not a valid link.');

        const hasStart = !!ev?.start_time;
        const hasEnd = !!ev?.end_time;

        if (!partial && (!hasStart || !hasEnd)) {
            add('Every event needs a start and end time.');
            return;
        }
        if (!hasStart || !hasEnd) return; // still being filled in

        const start = new Date(ev.start_time);
        const end = new Date(ev.end_time);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            add('That start or end time is not a valid date.');
            return;
        }
        if (start >= end) add('An event has to end after it starts.');
        if (end - start > EVENT_LIMITS.MAX_HOURS * HOUR_MS) {
            add('Events cannot run longer than 12 hours.');
        }
        // Only enforced on submit. A draft saved on Monday for a Tuesday event would
        // otherwise start failing validation the moment Tuesday passed, locking the club
        // out of their own page with an error about a field they already filled in.
        if (!partial && start < new Date()) add('That event starts in the past.');
    });

    return { valid: errors.length === 0, errors };
}

/** Shape the wizard stores into what POST /api/events and club_events expect. */
export function toEventRow(ev, clubId, clubName) {
    const row = {
        id_of_club: clubId,
        club_name: clubName,
        event_description: (ev?.description ?? '').trim() || null,
        start_time: ev?.start_time,
        end_time: ev?.end_time,
        is_members_only: ev?.is_members_only === true,
    };
    const name = (ev?.event_name ?? '').trim();
    const where = (ev?.where ?? '').trim();
    const image = (ev?.image_url ?? '').trim();
    if (name) row.event_name = name;
    if (where) row.where = where;
    // club_events calls the column event_image_url; POST /api/events maps imageUrl onto
    // it the same way.
    if (image) row.event_image_url = image;
    return row;
}
