import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { decide } from './decisionLayer.js';

const HANDLERS = {
  friend_request:    () => import('./handlers/friendRequest.js'),
  friend_accepted:   () => import('./handlers/friendAccepted.js'),
  new_club_event:    () => import('./handlers/newClubEvent.js'),
  new_review:        () => import('./handlers/newReview.js'),
  club_announcement: () => import('./handlers/clubAnnouncement.js'),
};

export const NotificationService = {
  /**
   * Never rejects — one bad recipient must not abort a fan-out midway.
   *
   * It does now REPORT, which it did not before. Every failure was caught here and
   * turned into a resolved promise, so a caller wrapping this in Promise.allSettled saw
   * every entry as fulfilled no matter what happened. A fan-out could fail for all 500
   * members and the caller could not tell. Existing callers ignore the return value, so
   * adding one is backward compatible.
   *
   * @returns {Promise<{ ok: boolean, skipped?: string, error?: string }>}
   */
  async dispatch(event) {
    const { type } = event;
    try {
      const loadHandler = HANDLERS[type];
      if (!loadHandler) {
        console.warn('[notifications] no handler for type:', type);
        return { ok: false, error: `no handler for type ${type}` };
      }
      const handler = await loadHandler();

      const { channels, skip } = await decide(event);
      if (skip) {
        // Logged as well as returned. Three of the four callers discard the return
        // value, so returning it INSTEAD of logging made friend_request,
        // friend_accepted, new_club_event and new_review skips invisible — trading four
        // types' observability for one's.
        console.log(`[notifications] skipping ${type}: ${skip}`);
        return { ok: false, skipped: skip };
      }

      let delivered = false;

      if (channels.includes('in_app')) {
        const row = handler.buildRow(event);
        const { error } = await supabaseAdmin
          .from('notifications')
          .insert({ id: randomUUID(), ...row, channel_status: { in_app: 'delivered' } });
        if (error) throw error;
        delivered = true;
      }

      // email and push are stubbed — skipped until templates exist
      return delivered ? { ok: true } : { ok: false, skipped: 'no_channels' };
    } catch (err) {
      // Log the whole error, not just .message: a PostgrestError carries code, details
      // and hint, and those are the fields that name the actual problem.
      console.error(`[notifications] dispatch failed for ${type}:`, err);
      return { ok: false, error: err?.message ?? String(err) };
    }
  },
};
