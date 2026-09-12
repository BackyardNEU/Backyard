import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { registry } from './registry';
import Avatar from '../components/Avatar';

export function NotificationItem({ notification, onRespond, onClose }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const entry = registry[notification.type];
  if (!entry) return null;

  const message = entry.message(notification);
  const isPending = !notification.action_taken && entry.actions?.length > 0;
  const avatarUrl = entry.image ? entry.image(notification) : notification.actor?.avatar_url;
  const avatarUsername = entry.image ? null : notification.actor?.username;
  const url = entry.getUrl?.(notification) ?? null;

  function handleAvatarClick(e) {
    e.stopPropagation();
    if (!url) return;
    onClose?.();
    navigate(url);
  }

  function handleKeyDown(e) {
    if (!url || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    handleClick();
  }

  return (
    <div
      className={`notif-item${!notification.read_at ? ' notif-item--unread' : ''}${expanded ? ' notif-item--expanded' : ''}`}
      onClick={() => setExpanded((prev) => !prev)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded((prev) => !prev); } }}
      tabIndex={0}
    >
      {/* Avatar is a separate button so clicking it navigates without toggling expand */}
      <button
        className={`notif-avatar-btn${url ? ' notif-avatar-btn--linked' : ''}`}
        onClick={handleAvatarClick}
        type="button"
        tabIndex={url ? 0 : -1}
        aria-label={url ? 'Go to club page' : undefined}
      >
        <Avatar
          className="notif-avatar"
          url={avatarUrl}
          username={avatarUsername}
        />
      </button>
      <div className="notif-content">
        <p className={`notif-message${expanded ? '' : ' notif-message--collapsed'}`}>{message}</p>
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
