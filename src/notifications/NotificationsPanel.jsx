import { useEffect } from 'react';
import { createPortal } from 'react-dom';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { NotificationItem } from './NotificationItem';
import './notifications.css';

const CATEGORY_ORDER = ['club', 'user', 'other'];
const CATEGORY_LABELS = { club: 'Clubs', user: 'People', other: 'Other' };

function groupByCategory(notifications) {
  const groups = { club: [], user: [], other: [] };
  for (const n of notifications) {
    const cat = n.entity_type === 'club' || n.entity_type === 'user' ? n.entity_type : 'other';
    groups[cat].push(n);
  }
  return groups;
}

export function NotificationsPanel({ onClose, notifications, markAllRead, respondToRequest }) {
  const groups = groupByCategory(notifications);

  useEffect(() => {
    markAllRead();
  }, []);

  return createPortal(
    <>
      <motion.div
        className="notif-backdrop"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      />
      {/* Slides in from the right edge it is anchored to, rather than appearing outright.
          Animating x as a percentage keeps it correct at both the 420px desktop width and
          the full-bleed mobile one, and stays on the compositor — animating `right` would
          lay out on every frame. */}
      <motion.div
        className="notif-panel"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="notif-panel-header">
          <h2>Activity</h2>
          <button className="notif-panel-close" onClick={onClose}>×</button>
        </div>

        {CATEGORY_ORDER.map((cat) => {
          const items = groups[cat];
          if (!items.length) return null;
          return (
            <div key={cat} className="notif-section">
              <div className="notif-section-title">{CATEGORY_LABELS[cat]}</div>
              {items.map((n) => (
                <NotificationItem key={n.id} notification={n} onRespond={respondToRequest} onClose={onClose} />
              ))}
            </div>
          );
        })}

        {notifications.length === 0 && (
          <p className="notif-empty">No notifications yet.</p>
        )}
      </motion.div>
    </>,
    document.body
  );
}
