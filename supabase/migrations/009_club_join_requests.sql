-- Request-to-join: clubs can require approval instead of admitting anyone who clicks.
-- Run against the Supabase SQL editor or via `supabase db push`.

-- 1. Per-club policy. Defaults to 'open' so every existing club keeps behaving exactly
--    as it does today and nothing needs backfilling.
ALTER TABLE demo_club_data
  ADD COLUMN IF NOT EXISTS join_policy text NOT NULL DEFAULT 'open'
  CHECK (join_policy IN ('open', 'request'));

-- 2. The requests themselves. Decided rows are kept rather than deleted so a club can
--    see that it already turned someone down.
CREATE TABLE IF NOT EXISTS club_join_requests (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid        NOT NULL REFERENCES demo_club_data(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  status     text        NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'approved', 'denied')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

-- One live request per person per club. Partial, so the constraint only covers pending
-- rows: a full UNIQUE (club_id, user_id) would mean a single denial locked someone out
-- of ever asking again.
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_request_per_user_per_club
  ON club_join_requests (club_id, user_id) WHERE status = 'pending';

-- Moderators list pending requests for one club at a time.
CREATE INDEX IF NOT EXISTS idx_club_join_requests_club_status
  ON club_join_requests (club_id, status);

-- 3. RLS on with no policies, matching club_memberships in 002. supabaseAdmin bypasses
--    it and the Express API is the only writer; this denies everything else by default.
ALTER TABLE club_join_requests ENABLE ROW LEVEL SECURITY;
