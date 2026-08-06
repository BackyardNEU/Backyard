import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { isToday, isThisWeek } from 'date-fns';
import { NotificationItem } from './NotificationItem';
import './notifications.css';

function groupNotifications(notifications) {
  const today = [], thisWeek = [], earlier = [];
  for (const n of notifications) {
    const date = new Date(n.created_at);
    if (isToday(date)) today.push(n);
    else if (isThisWeek(date)) thisWeek.push(n);
    else earlier.push(n);
  }
  return { today, thisWeek, earlier };
}

export function NotificationsPanel({ onClose, notifications, markAllRead, respondToRequest }) {
  const pending = notifications.filter((n) => n.type === 'friend_request' && !n.action_taken);
  const { today, thisWeek, earlier } = groupNotifications(notifications);

  useEffect(() => {
    markAllRead();
  }, []);

  return createPortal(
    <>
      <div className="notif-backdrop" onClick={onClose} />
      <div className="notif-panel">
        <div className="notif-panel-header">
          <h2>Activity</h2>
          <button className="notif-panel-close" onClick={onClose}>×</button>
        </div>

        {pending.length > 0 && (
          <div className="notif-section">
            <div className="notif-section-title">Requests</div>
            {pending.map((n) => (
              <NotificationItem key={n.id} notification={n} onRespond={respondToRequest} />
            ))}
          </div>
        )}

        {today.length > 0 && (
          <div className="notif-section">
            <div className="notif-section-title">Today</div>
            {today.map((n) => (
              <NotificationItem key={n.id} notification={n} onRespond={respondToRequest} />
            ))}
          </div>
        )}

        {thisWeek.length > 0 && (
          <div className="notif-section">
            <div className="notif-section-title">This week</div>
            {thisWeek.map((n) => (
              <NotificationItem key={n.id} notification={n} onRespond={respondToRequest} />
            ))}
          </div>
        )}

        {earlier.length > 0 && (
          <div className="notif-section">
            <div className="notif-section-title">Earlier</div>
            {earlier.map((n) => (
              <NotificationItem key={n.id} notification={n} onRespond={respondToRequest} />
            ))}
          </div>
        )}

        {notifications.length === 0 && (
          <p className="notif-empty">No notifications yet.</p>
        )}
      </div>
    </>,
    document.body
  );
}
