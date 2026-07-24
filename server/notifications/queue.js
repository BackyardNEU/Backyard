import { createRequire } from 'module';
import 'dotenv/config';

const require = createRequire(import.meta.url);
const PgBoss = require('pg-boss');
import { supabaseAdmin } from '../supabaseAdmin.js';
import { decide } from './decisionLayer.js';
import { sendInApp } from './channels/inApp.js';
import { sendEmail } from './channels/email.js';
import { sendPush } from './channels/push.js';

const HANDLERS = {
  friend_request:  () => import('./handlers/friendRequest.js'),
  friend_accepted: () => import('./handlers/friendAccepted.js'),
};

export const boss = new PgBoss({ connectionString: process.env.DATABASE_URL });

export async function startQueue() {
  await boss.start();
  console.log('[queue] pg-boss started');

  await boss.work('notifications.dispatch', async ([job]) => {
    const event = job.data;

    const loadHandler = HANDLERS[event.type];
    if (!loadHandler) {
      console.warn('[queue] no handler for type:', event.type);
      return;
    }
    const handler = await loadHandler();

    const { channels, skip } = await decide(event);
    if (skip || channels.length === 0) {
      console.log(`[queue] skipping ${event.type} for ${event.recipientId}: ${skip ?? 'no channels'}`);
      return;
    }

    const row = handler.buildRow(event);
    const channelStatus = {};
    let notificationId = null;

    if (channels.includes('in_app')) {
      notificationId = await sendInApp(row);
      channelStatus.in_app = 'delivered';
    }

    if (channels.includes('email')) {
      channelStatus.email = await sendEmail(event, handler);
    }

    if (channels.includes('push')) {
      channelStatus.push = await sendPush(event);
    }

    if (notificationId) {
      await supabaseAdmin
        .from('notifications')
        .update({ channel_status: channelStatus })
        .eq('id', notificationId);
    }
  });

  console.log('[queue] workers registered');
}
