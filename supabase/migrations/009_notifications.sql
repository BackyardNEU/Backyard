-- Notifications system: in-app notification log and per-user channel preferences.
-- Tables were previously created manually in Supabase; this migration puts them
-- in version control and adds any columns that may be missing.

CREATE TABLE IF NOT EXISTS notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type            text NOT NULL,
  entity_type     text,
  entity_id       uuid,
  channel_status  jsonb NOT NULL DEFAULT '{}',
  read_at         timestamptz,
  action_taken    boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Add any columns that manual creation may have omitted
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_type    text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_id      uuid;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS channel_status jsonb NOT NULL DEFAULT '{}';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_taken   boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS notifications_recipient_created
  ON notifications (recipient_id, created_at DESC);

-- RLS: each user can only see and update their own notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recipient can read own notifications"  ON notifications;
DROP POLICY IF EXISTS "recipient can update own notifications" ON notifications;

CREATE POLICY "recipient can read own notifications"
  ON notifications FOR SELECT
  USING (recipient_id = auth.uid());

CREATE POLICY "recipient can update own notifications"
  ON notifications FOR UPDATE
  USING (recipient_id = auth.uid());

-- Service role bypasses RLS for server-side writes — no INSERT policy needed
-- (supabaseAdmin uses service role key which skips RLS entirely).

-- Realtime: let the client subscribe to new rows for the logged-in user
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Per-user channel preferences. Rows are negative overrides only:
-- no row = channel enabled. The wildcard type '*' applies to all notification types.
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type     text NOT NULL,
  channel  text NOT NULL,
  enabled  boolean NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, type, channel)
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user can manage own preferences" ON notification_preferences;

CREATE POLICY "user can manage own preferences"
  ON notification_preferences FOR ALL
  USING (user_id = auth.uid());
