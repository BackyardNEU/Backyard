import { formatDistanceToNow } from 'date-fns';
import { registry } from './registry';

export function NotificationItem({ notification, onRespond }) {
  const entry = registry[notification.type];
  if (!entry) return null;

  const message = entry.message({ actor: notification.actor });
  const isPending = !notification.action_taken && entry.actions?.length > 0;

  return (
    <div className={`notif-item${!notification.read_at ? ' notif-item--unread' : ''}`}>
      <img
        className="notif-avatar"
        src={notification.actor?.avatar_url || '/raccoon_pfp.png'}
        alt={notification.actor?.username ?? 'User'}
      />
      <div className="notif-content">
        <p className="notif-message">{message}</p>
        <span className="notif-time">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </span>
        {isPending && (
          <div className="notif-actions">
            <button
              className="notif-action-btn notif-action-btn--accept"
              onClick={() => onRespond(notification.entity_id, 'accepted')}
            >
              Accept
            </button>
            <button
              className="notif-action-btn notif-action-btn--decline"
              onClick={() => onRespond(notification.entity_id, 'declined')}
            >
              Decline
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
