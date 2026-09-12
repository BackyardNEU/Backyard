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
  // entity_type drives both what the avatar shows and where it navigates.
  // 'user' → person photo → actor profile; 'club'/'other' → club logo → club page.
  const isUserEntity = notification.entity_type === 'user';
  const avatarUrl = isUserEntity ? notification.actor?.avatar_url : entry.image?.(notification) ?? null;
  const avatarUsername = isUserEntity ? notification.actor?.username : null;
  const url = entry.getUrl?.(notification) ?? null;
  const avatarHref = isUserEntity
    ? (notification.actor_id ? `/friend/${notification.actor_id}` : null)
    : url;

  function handleAvatarClick(e) {
    e.stopPropagation();
    if (!avatarHref) return;
    onClose?.();
    navigate(avatarHref);
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
        className={`notif-avatar-btn${avatarHref ? ' notif-avatar-btn--linked' : ''}`}
        onClick={handleAvatarClick}
        type="button"
        tabIndex={avatarHref ? 0 : -1}
        aria-label={avatarHref ? (isUserEntity ? 'Go to profile' : 'Go to club page') : undefined}
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
