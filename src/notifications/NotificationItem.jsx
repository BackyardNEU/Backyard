import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { registry } from './registry';
import Avatar from '../components/Avatar';

export function NotificationItem({ notification, onRespond, onClose }) {
  const navigate = useNavigate();
  const entry = registry[notification.type];
  if (!entry) return null;

  const message = entry.message(notification);
  const isPending = !notification.action_taken && entry.actions?.length > 0;
  const avatarUrl = entry.image ? entry.image(notification) : notification.actor?.avatar_url;
  const avatarUsername = entry.image ? null : notification.actor?.username;
  const url = entry.getUrl?.(notification) ?? null;

  function handleClick() {
    if (!url) return;
    onClose?.();
    navigate(url);
  }

  return (
    <div
      className={`notif-item${!notification.read_at ? ' notif-item--unread' : ''}${url ? ' notif-item--clickable' : ''}`}
      onClick={handleClick}
      onKeyDown={url ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } } : undefined}
      role={url ? 'button' : undefined}
      tabIndex={url ? 0 : undefined}
    >
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
              onClick={(e) => { e.stopPropagation(); onRespond(notification.entity_id, 'accepted', notification.id); }}
            >
              Accept
            </button>
            <button
              className="notif-action-btn notif-action-btn--decline"
              onClick={(e) => { e.stopPropagation(); onRespond(notification.entity_id, 'declined', notification.id); }}
            >
              Decline
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
