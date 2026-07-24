-- Content moderation: strike tracking + mute support
-- Run this against the Supabase SQL editor or via `supabase db push`

-- 1. content_strikes: records each flagged image upload
CREATE TABLE IF NOT EXISTS content_strikes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category    text        NOT NULL,
  details     jsonb       DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_strikes_user_created
  ON content_strikes (user_id, created_at DESC);

ALTER TABLE content_strikes ENABLE ROW LEVEL SECURITY;

-- 2. Add muted_until column to profiles (nullable = not muted)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS muted_until timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_muted_until
  ON profiles (muted_until)
  WHERE muted_until IS NOT NULL;
