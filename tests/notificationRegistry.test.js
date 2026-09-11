import { describe, it, expect } from 'vitest';
import { registry } from '../src/notifications/registry.js';

const announcement = registry.club_announcement;

const notif = (payload) => ({ type: 'club_announcement', payload });

describe('club_announcement notification', () => {
    // The link used to be /university/<uniId> with no club, which dropped the member on
    // a hub of every club tile with no indication of who had announced. UniversityPage
    // reads ?club into autoExpandId and opens that tile.
    it('links to the club that announced, not just the university', () => {
        expect(announcement.getUrl(notif({ uniId: 'uni-1', clubId: 'club-9' })))
            .toBe('/university/uni-1?club=club-9');
    });

    // uni_names is matched by exact string rather than a foreign key, so a miss is
    // routine. NotificationItem checks for null and renders a non-clickable row.
    it('is not clickable when no university resolved', () => {
        expect(announcement.getUrl(notif({ uniId: null, clubId: 'club-9' }))).toBeNull();
        expect(announcement.getUrl(notif({}))).toBeNull();
        expect(announcement.getUrl({ type: 'club_announcement' })).toBeNull();
    });

    // Older rows written before payload.clubId existed must not produce
    // "/university/uni-1?club=undefined".
    it('falls back to the university alone when the club id is absent', () => {
        expect(announcement.getUrl(notif({ uniId: 'uni-1' }))).toBe('/university/uni-1');
    });

    describe('message', () => {
        it('includes the club name and the body', () => {
            expect(announcement.message(notif({ clubName: 'Chess Club', message: 'Meeting at 7' })))
                .toBe('Chess Club: Meeting at 7');
        });

        it('includes the title when there is one', () => {
            expect(announcement.message(notif({ clubName: 'Chess Club', title: 'Practice', message: 'Moved to 8' })))
                .toBe('Chess Club — Practice: Moved to 8');
        });

        // The club lookup can fail; the route now aborts rather than sending an
        // anonymous notification, but rows written before that fix still exist.
        it('degrades rather than rendering undefined', () => {
            expect(announcement.message(notif({ message: 'hi' }))).toBe('A club: hi');
            expect(announcement.message(notif({}))).toBe('A club: ');
        });
    });

    it('uses the club logo as the avatar when there is one', () => {
        expect(announcement.image(notif({ imageUrl: 'https://img/c.png' }))).toBe('https://img/c.png');
        expect(announcement.image(notif({}))).toBeNull();
    });

    // Only friend_request carries actions; an announcement is informational, so
    // NotificationItem must not render Accept/Decline on it.
    it('has no actions', () => {
        expect(announcement.actions ?? []).toHaveLength(0);
    });
});
