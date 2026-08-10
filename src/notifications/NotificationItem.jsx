import { formatDistanceToNow } from 'date-fns';
import { registry } from './registry';
import Avatar from '../components/Avatar';

export function NotificationItem({ notification, onRespond }) {
  const entry = registry[notification.type];
  if (!entry) return null;

  const message = entry.message({ actor: notification.actor });
  const isPending = !notification.action_taken && entry.actions?.length > 0;

  return (
    <div className={`notif-item${!notification.read_at ? ' notif-item--unread' : ''}`}>
      <Avatar
        className="notif-avatar"
        url={notification.actor?.avatar_url}
        username={notification.actor?.username}
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
              onClick={() => onRespond(notification.entity_id, 'accepted', notification.id)}
            >
              Accept
            </button>
            <button
              className="notif-action-btn notif-action-btn--decline"
              onClick={() => onRespond(notification.entity_id, 'declined', notification.id)}
            >
              Decline
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
