import { boss } from './queue.js';

export const NotificationService = {
  async dispatch({ type, recipientId, actorId = null, entity = null, payload = {} }) {
    await boss.send('notifications.dispatch', {
      type,
      recipientId,
      actorId,
      entity,
      payload,
    });
  },
};
