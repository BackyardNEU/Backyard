import { useState } from 'react';
import { Bell } from 'lucide-react';
// eslint-disable-next-line no-unused-vars
import { AnimatePresence } from 'framer-motion';
import { useGlobalStore } from '../lib/store';
import { useNotifications } from './useNotifications';
import { NotificationsPanel } from './NotificationsPanel';

export function NotificationBell({ className = '', style }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const unreadCount = useGlobalStore((s) => s.unreadCount);
  const { notifications, markAllRead, respondToRequest } = useNotifications();

  return (
    <>
      <button className={`notif-bell ${className}`.trim()} style={style} onClick={() => setPanelOpen(true)} aria-label="Notifications">
        <Bell size={22} />
        {unreadCount > 0 && (
          <span className="notif-dot" />
        )}
      </button>

      {/* Has to live here rather than inside the panel: AnimatePresence can only play an
          exit animation for a child it still owns, so the conditional must be its child. */}
      <AnimatePresence>
        {panelOpen && (
          <NotificationsPanel
            onClose={() => setPanelOpen(false)}
            notifications={notifications}
            markAllRead={markAllRead}
            respondToRequest={respondToRequest}
          />
        )}
      </AnimatePresence>
    </>
  );
}
