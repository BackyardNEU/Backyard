import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { useGlobalStore } from '../lib/store';

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const isLoggedIn = useGlobalStore((s) => s.GlobalValue);
  const setUnreadCount = useGlobalStore((s) => s.setUnreadCount);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await apiFetch('/me/notifications');
      setNotifications(data || []);
      setUnreadCount((data || []).filter((n) => !n.read_at).length);
    } catch (err) {
      console.error('[useNotifications] fetch error:', err);
    }
  }, [setUnreadCount]);

  useEffect(() => {
    if (!isLoggedIn) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    fetchNotifications();
  }, [isLoggedIn, fetchNotifications, setUnreadCount]);

  // Realtime: refetch when a new notification row is inserted for this user
  useEffect(() => {
    if (!isLoggedIn) return;
    let channel;
    let cancelled = false;

    supabase.auth.getUser().then(({ data: { user } }) => {
      // The effect can be torn down while getUser() is still in flight. Cleanup only
      // removes `channel`, which is still undefined at that point, so the old channel
      // survives — and because the topic name is fixed, the next run gets that same
      // already-subscribed channel back from supabase.channel(). Calling .on() on a
      // subscribed channel throws "cannot add postgres_changes callbacks ... after
      // subscribe()", which killed realtime notifications entirely. StrictMode's double
      // effect invocation triggered it on every mount in development.
      if (cancelled || !user) return;

      channel = supabase
        .channel('my-notifications')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        }, () => fetchNotifications())
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [isLoggedIn, fetchNotifications]);

  const markAllRead = useCallback(async () => {
    try {
      await apiFetch('/me/notifications/read-all-visible', { method: 'POST' });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('[useNotifications] markAllRead error:', err);
    }
  }, [setUnreadCount]);

  const respondToRequest = useCallback(async (requestId, action, notificationId) => {
    try {
      await apiFetch(`/friend-requests/${requestId}`, {
        method: 'PATCH',
        body: { status: action },
      });
      if (notificationId) {
        await apiFetch(`/me/notifications/${notificationId}`, {
          method: 'PATCH',
          body: { action_taken: true },
        });
      }
      fetchNotifications();
    } catch (err) {
      console.error('[useNotifications] respondToRequest error:', err);
    }
  }, [fetchNotifications]);

  return { notifications, markAllRead, respondToRequest };
}
