import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useGlobalStore } from '../lib/store';
import { useNotifications } from './useNotifications';
import { NotificationsPanel } from './NotificationsPanel';

export function NotificationBell() {
  const [panelOpen, setPanelOpen] = useState(false);
  const unreadCount = useGlobalStore((s) => s.unreadCount);
  const { notifications, markAllRead, respondToRequest } = useNotifications();

  return (
    <>
      <button className="notif-bell" onClick={() => setPanelOpen(true)} aria-label="Notifications">
        <Bell size={22} />
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {panelOpen && (
        <NotificationsPanel
          onClose={() => setPanelOpen(false)}
          notifications={notifications}
          markAllRead={markAllRead}
          respondToRequest={respondToRequest}
        />
      )}
    </>
  );
}
