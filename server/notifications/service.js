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
  // Returns { ok: true } on delivery, { skipped: reason } when dedup/prefs suppress it,
  // or { error: message } on any failure. Callers that don't use the return value still
  // benefit from the console output; callers like the announcement fan-out use it to
  // log aggregate delivered/skipped/failed counts.
  async dispatch(event) {
    const { type } = event;
    try {
      const loadHandler = HANDLERS[type];
      if (!loadHandler) {
        console.warn('[notifications] no handler for type:', type);
        return { error: `no handler for type: ${type}` };
      }
      const handler = await loadHandler();

      const { channels, skip } = await decide(event);
      if (skip) {
        // Logged as well as returned. Three of the four callers discard the return
        // value, so returning it INSTEAD of logging made friend_request,
        // friend_accepted, new_club_event and new_review skips invisible — trading four
        // types' observability for one's.
        console.log(`[notifications] skipping ${type}: ${skip}`);
        return { skipped: skip };
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
      return { ok: true };
    } catch (err) {
      console.error('[notifications] dispatch failed:', err.message);
      return { error: err.message };
    }
  },
};
