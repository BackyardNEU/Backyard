-- Backing store for the settings page.
--
-- Two things: a calendar-export preference on profiles, and the notification_preferences
-- table — which docs/NOTIFICATION_PLAN.md lists as a migration to write but which no
-- migration in this repo ever created.
--
-- Idempotent; safe to re-run.

-- ─── Calendar export preference ──────────────────────────────────────────────────────
-- Defaults to 'ics' because that format imports everywhere — Apple Calendar, Outlook,
-- Fantastical, and Google can all read it — so an unset preference still works.
--
-- Must also be added to PROFILE_WRITABLE in server/routes/profiles.js. pickWritable
-- silently drops anything not in that allowlist, so the column alone is not enough.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS calendar_preference text NOT NULL DEFAULT 'ics';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_calendar_preference_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_calendar_preference_check
      CHECK (calendar_preference IN ('ics', 'google'));
  END IF;
END $$;

-- ─── Notification preferences ────────────────────────────────────────────────────────
-- Read by server/notifications/decisionLayer.js. Rows are NEGATIVE OVERRIDES ONLY:
-- the absence of a row means the channel is enabled, so no backfill is needed and new
-- users start with everything on.
--
-- type = '*' is a wildcard applying to every notification type. The settings UI writes
-- only wildcard rows (per-channel master toggles); without it, a master toggle would have
-- to write one row per known type and any type added later would silently default back
-- to on. decisionLayer queries .in('type', [type, '*']) and lets a specific-type row win.
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id  uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type     text    NOT NULL,
  channel  text    NOT NULL,
  enabled  boolean NOT NULL DEFAULT true,

  PRIMARY KEY (user_id, type, channel),
  CONSTRAINT notification_preferences_channel_check
    CHECK (channel IN ('in_app', 'email', 'push'))
);

-- decisionLayer looks up by (user_id, type) on every dispatch.
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_type
  ON notification_preferences (user_id, type);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Defense in depth; the API reaches Postgres through supabaseAdmin, which bypasses RLS.
DROP POLICY IF EXISTS notification_preferences_own ON notification_preferences;
CREATE POLICY notification_preferences_own ON notification_preferences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
