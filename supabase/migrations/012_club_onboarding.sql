-- Club onboarding: per-club claim links + a review pipeline for pages authored
-- by people outside the team.
-- Run this against the Supabase SQL editor or via `supabase db push`
--
-- club_invite_links was created by hand in the dashboard and has never had a
-- migration, so its real shape is unverified from source. CREATE TABLE IF NOT EXISTS
-- gives a fresh environment the right shape; the ALTERs after it converge an existing
-- dashboard table to that same shape. Using IF NOT EXISTS *alone* would silently
-- no-op against the live table and leave a migration file that lies about the schema.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ── 1. club_invite_links ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS club_invite_links (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token        text,        -- plaintext; dropped in 013 after the code cutover
  token_hash   text,
  token_prefix text,        -- first 8 hex chars, so a CSV row can be matched to a row here
  club_id      uuid        NOT NULL REFERENCES demo_club_data(id) ON DELETE CASCADE,
  created_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  link_type    text        NOT NULL DEFAULT 'member',
  max_uses     integer,
  use_count    integer     NOT NULL DEFAULT 0,
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  is_revoked   boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Nothing writes plaintext token any more. If the dashboard table declared it NOT NULL,
-- every insert would fail the moment this migration lands, so the constraint has to go
-- before 013 drops the column entirely.
ALTER TABLE club_invite_links ALTER COLUMN token DROP NOT NULL;

ALTER TABLE club_invite_links ADD COLUMN IF NOT EXISTS token_hash   text;
ALTER TABLE club_invite_links ADD COLUMN IF NOT EXISTS token_prefix text;
ALTER TABLE club_invite_links ADD COLUMN IF NOT EXISTS created_at   timestamptz NOT NULL DEFAULT now();
ALTER TABLE club_invite_links ADD COLUMN IF NOT EXISTS use_count    integer     NOT NULL DEFAULT 0;
ALTER TABLE club_invite_links ADD COLUMN IF NOT EXISTS is_revoked   boolean     NOT NULL DEFAULT false;
ALTER TABLE club_invite_links ADD COLUMN IF NOT EXISTS link_type    text;

-- POST /api/clubs/:clubId/invite-link never set expires_at, and the GET handler does
-- `new Date(data.expires_at) < new Date()`. new Date(null) is the 1970 epoch, so a
-- NULL here reads as permanently expired — i.e. every member invite link ever created
-- through that endpoint reports "expired". Pin the default so that cannot recur, and
-- repair any rows already in that state.
ALTER TABLE club_invite_links
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '7 days');

UPDATE club_invite_links
   SET expires_at = COALESCE(created_at, now()) + interval '7 days'
 WHERE expires_at IS NULL;

-- Backfill hashes so links already handed out keep working across the cutover.
UPDATE club_invite_links
   SET token_hash   = encode(extensions.digest(token, 'sha256'), 'hex'),
       token_prefix = left(token, 8)
 WHERE token IS NOT NULL AND token_hash IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS club_invite_links_token_hash_key
  ON club_invite_links (token_hash);

-- The member-link insert never set link_type, so those rows are NULL.
UPDATE club_invite_links SET link_type = 'member' WHERE link_type IS NULL;
ALTER TABLE club_invite_links ALTER COLUMN link_type SET DEFAULT 'member';
ALTER TABLE club_invite_links ALTER COLUMN link_type SET NOT NULL;

-- Adding 'onboarding' means replacing whatever CHECK the dashboard may have written
-- under a name we cannot predict from source.
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'club_invite_links'::regclass
       AND contype  = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%link_type%'
  LOOP
    EXECUTE format('ALTER TABLE club_invite_links DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE club_invite_links
  ADD CONSTRAINT club_invite_links_link_type_check
  CHECK (link_type IN ('member', 'editor', 'onboarding'));

-- One live onboarding link per club. This is what makes bulk minting idempotent at
-- the database level rather than only in application logic — a concurrent double
-- submit cannot produce two live links for the same club.
--
-- The predicate deliberately omits expires_at: index predicates must be IMMUTABLE and
-- now() is not. An expired-but-unrevoked link therefore still holds the slot, so the
-- mint endpoint revokes before inserting.
CREATE UNIQUE INDEX IF NOT EXISTS one_live_onboarding_link_per_club
  ON club_invite_links (club_id)
  WHERE link_type = 'onboarding' AND is_revoked = false;

CREATE INDEX IF NOT EXISTS idx_club_invite_links_club ON club_invite_links (club_id);

ALTER TABLE club_invite_links ENABLE ROW LEVEL SECURITY;
-- No policies: the API reaches this table through the service-role key, which bypasses
-- RLS. Deny-all for anon/authenticated is exactly right.

-- ── 2. club_invite_redemptions ──────────────────────────────────────────────
-- Makes redemption idempotent per user, so a double-click cannot burn two uses, and
-- gives an audit trail of who claimed what.
CREATE TABLE IF NOT EXISTS club_invite_redemptions (
  link_id     uuid        NOT NULL REFERENCES club_invite_links(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id)        ON DELETE CASCADE,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (link_id, user_id)
);

ALTER TABLE club_invite_redemptions ENABLE ROW LEVEL SECURITY;

-- ── 3. club_onboarding ──────────────────────────────────────────────────────
-- Deliberately NOT columns on demo_club_data or club_page_data.
--
--   club_page_data: GET /api/clubs/:clubId/page is public, unauthenticated, select('*')
--                   — review state and claimant UUIDs would be world-readable.
--   demo_club_data: the search_clubs RPC returns a column list fixed in the database,
--                   outside PUBLIC_CLUB_COLUMNS. server/routes/search.js:65-67 already
--                   warns about this. Anything added there is public by a path this
--                   repo cannot audit.
--
-- The draft lives here too, and approve fans it out to the public tables. That makes
-- the approval gate a property of where the data physically sits rather than a flag
-- the client is trusted to honour, and it makes reject-with-note non-destructive.
CREATE TABLE IF NOT EXISTS club_onboarding (
  club_id      uuid        PRIMARY KEY REFERENCES demo_club_data(id) ON DELETE CASCADE,
  status       text        NOT NULL DEFAULT 'unclaimed'
                           CHECK (status IN ('unclaimed', 'claimed', 'pending_review',
                                             'approved', 'changes_requested')),
  -- { details: {...}, modules: [...] } — staged, never public until approve.
  draft        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  claimed_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at   timestamptz,
  submitted_at timestamptz,
  reviewed_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at  timestamptz,
  review_note  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 'changes_requested' rather than folding rejection back into 'claimed': otherwise
-- every consumer has to disambiguate "never submitted" from "was sent back" by
-- comparing reviewed_at against submitted_at. Not 'rejected', because it is not
-- terminal — the club edits and resubmits.
CREATE INDEX IF NOT EXISTS idx_club_onboarding_status
  ON club_onboarding (status, submitted_at);

ALTER TABLE club_onboarding ENABLE ROW LEVEL SECURITY;

-- ── 4. Atomic redeem ────────────────────────────────────────────────────────
-- Replaces a read-modify-write in the redeem handler that let two concurrent redeems
-- of a max_uses=1 link both succeed. SELECT ... FOR UPDATE serialises them.
--
-- Returns zero rows for every invalid case (unknown / revoked / expired / exhausted)
-- so the caller can collapse them into one 410 and avoid a response oracle.
CREATE OR REPLACE FUNCTION consume_invite_link(p_token_hash text, p_user_id uuid)
RETURNS TABLE (link_id uuid, club_id uuid, link_type text, first_use boolean)
LANGUAGE plpgsql
-- SECURITY INVOKER: the API calls this as service_role, which already bypasses RLS.
-- DEFINER would add nothing and would turn a stray GRANT into privilege escalation.
SECURITY INVOKER
AS $$
DECLARE
  v_link club_invite_links%ROWTYPE;
  v_seen boolean;
BEGIN
  SELECT * INTO v_link FROM club_invite_links
   WHERE token_hash = p_token_hash FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;
  IF v_link.is_revoked THEN RETURN; END IF;
  -- NULL expires_at means "never expires", not "expired in 1970".
  IF v_link.expires_at IS NOT NULL AND v_link.expires_at <= now() THEN RETURN; END IF;

  SELECT EXISTS (
    SELECT 1 FROM club_invite_redemptions r
     WHERE r.link_id = v_link.id AND r.user_id = p_user_id
  ) INTO v_seen;

  IF v_seen THEN
    -- Returning user: succeeds without burning another use. Safe to double-click,
    -- safe to bookmark.
    RETURN QUERY SELECT v_link.id, v_link.club_id, v_link.link_type, false;
    RETURN;
  END IF;

  IF v_link.max_uses IS NOT NULL AND v_link.use_count >= v_link.max_uses THEN
    RETURN;
  END IF;

  INSERT INTO club_invite_redemptions (link_id, user_id) VALUES (v_link.id, p_user_id);
  UPDATE club_invite_links SET use_count = use_count + 1 WHERE id = v_link.id;

  RETURN QUERY SELECT v_link.id, v_link.club_id, v_link.link_type, true;
END $$;

-- PostgREST exposes every function in `public` at /rest/v1/rpc/<name> to whoever holds
-- the anon key — which ships in the browser bundle. Nothing but the service-role API
-- may call this.
REVOKE ALL ON FUNCTION consume_invite_link(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION consume_invite_link(text, uuid) FROM anon;
REVOKE ALL ON FUNCTION consume_invite_link(text, uuid) FROM authenticated;

COMMIT;
