-- User blocking: mutual invisibility between two people.
-- Run this against the Supabase SQL editor or via `supabase db push`.

-- One row per block, directional (who blocked whom) so it can be undone by the person
-- who created it. Visibility is enforced mutually in the application layer: a row in
-- either direction hides both people from each other. Storing it directionally rather
-- than as an unordered pair keeps "unblock" unambiguous when both parties blocked
-- each other.
CREATE TABLE IF NOT EXISTS user_blocks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),

  -- Blocking the same person twice is a no-op, not an error the caller must handle.
  CONSTRAINT user_blocks_unique_pair UNIQUE (blocker_id, blocked_id),
  CONSTRAINT user_blocks_no_self CHECK (blocker_id <> blocked_id)
);

-- Both directions are queried on every gated request (getBlockedIds unions them), so
-- both need an index.
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks (blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks (blocked_id);

-- Defense in depth. The API reaches Postgres through supabaseAdmin, which uses the
-- service role and bypasses RLS, so this guards against a future path that does not.
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

-- A user may see and manage only the blocks they created. Deliberately no SELECT policy
-- for blocked_id: being able to read rows where you are the target would tell you who
-- has blocked you.
DROP POLICY IF EXISTS user_blocks_select_own ON user_blocks;
CREATE POLICY user_blocks_select_own ON user_blocks
  FOR SELECT USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS user_blocks_insert_own ON user_blocks;
CREATE POLICY user_blocks_insert_own ON user_blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS user_blocks_delete_own ON user_blocks;
CREATE POLICY user_blocks_delete_own ON user_blocks
  FOR DELETE USING (auth.uid() = blocker_id);
