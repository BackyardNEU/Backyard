import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { decide } from './decisionLayer.js';

const HANDLERS = {
  friend_request:  () => import('./handlers/friendRequest.js'),
  friend_accepted: () => import('./handlers/friendAccepted.js'),
};

export const NotificationService = {
  async dispatch(event) {
    const { type } = event;
    try {
      const loadHandler = HANDLERS[type];
      if (!loadHandler) {
        console.warn('[notifications] no handler for type:', type);
        return;
      }
      const handler = await loadHandler();

      const { channels, skip } = await decide(event);
      if (skip) {
        console.log(`[notifications] skipping ${type}: ${skip}`);
        return;
      }

      if (channels.includes('in_app')) {
        const row = handler.buildRow(event);
        const { error } = await supabaseAdmin
          .from('notifications')
          .insert({ id: randomUUID(), ...row, channel_status: { in_app: 'delivered' } });
        if (error) throw error;
      }

      // email and push are stubbed — skipped until templates exist
    } catch (err) {
      console.error('[notifications] dispatch failed:', err.message);
    }
  },
};
