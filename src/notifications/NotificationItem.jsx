import { formatDistanceToNow } from 'date-fns';
import { registry } from './registry';
import Avatar from '../components/Avatar';

export function NotificationItem({ notification, onRespond }) {
  const entry = registry[notification.type];
  if (!entry) return null;

  const message = entry.message(notification);
  const isPending = !notification.action_taken && entry.actions?.length > 0;
  const avatarUrl = entry.image ? entry.image(notification) : notification.actor?.avatar_url;
  const avatarUsername = entry.image ? null : notification.actor?.username;

  return (
    <div className={`notif-item${!notification.read_at ? ' notif-item--unread' : ''}`}>
      <Avatar
        className="notif-avatar"
        url={avatarUrl}
        username={avatarUsername}
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
