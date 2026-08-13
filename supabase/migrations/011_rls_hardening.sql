-- RLS hardening: remove world-writable policies on profiles and demo_club_data
-- Run this against the Supabase SQL editor or via `supabase db push`
--
-- WHY THIS IS URGENT
--
-- An audit of pg_policies before the club-onboarding work turned up four policies
-- granting the PUBLIC pseudo-role (which includes `anon`) unrestricted access:
--
--   demo_club_data  "update"          UPDATE  qual: true   -> rewrite ANY club
--   profiles        "update_profile"  UPDATE  qual: true   -> rewrite ANY profile
--   profiles        "logout users"    DELETE  qual: true   -> delete ANY profile
--   profiles        "Profiles readable" SELECT qual: true  -> dump every user's email
--
-- profiles also carries a correctly-scoped "Profiles self update" policy
-- (auth.uid() = id). That did NOT constrain the loose one: permissive policies for
-- the same command are OR'd, so `true` swallowed it and the strict policy was dead
-- code. This is the trap worth remembering — adding a strict policy next to a
-- permissive one changes nothing.
--
-- Reachable with nothing but the project URL and the anon key, which by design ships
-- in the browser bundle. Not yet exploitable only because no deployed artifact
-- contains that key today: the live landing page carries Resend credentials only.
-- The onboarding wizard would be the first public deployment to ship it, which is
-- what turns this from theoretical into live.
--
-- WHY DENY-ALL WRITES IS SAFE
--
-- Every mutation in this app goes through the Express API on the service-role key,
-- which bypasses RLS entirely. Verified before writing this: `grep -rn "supabase" src/`
-- finds no `.from()` calls at all — the only non-auth client usage in the frontend is
-- Realtime channels in src/notifications/useNotifications.js. Dropping these policies
-- therefore removes capability from attackers and from nobody else.
--
-- Reads stay open. demo_club_data is public club data, and clients still read profiles
-- through the API. Narrowing SELECT is worth doing later, but it is a behaviour change
-- and does not belong in a security fix.

BEGIN;

-- ── 1. demo_club_data ───────────────────────────────────────────────────────
-- "access" (SELECT, true) is intentional and stays: club data is public.
-- "update" (UPDATE, true) is not.
DROP POLICY IF EXISTS "update" ON demo_club_data;

-- ── 2. profiles ─────────────────────────────────────────────────────────────
-- Drop the three world-writable policies. "Profiles readable" (SELECT) is left in
-- place deliberately — see the note above about scope.
DROP POLICY IF EXISTS "update_profile" ON profiles;
DROP POLICY IF EXISTS "logout users"   ON profiles;
DROP POLICY IF EXISTS "insert_profile" ON profiles;

-- "Profiles self update" (auth.uid() = id) is retained. It is currently unreachable
-- because the frontend never writes to Supabase directly, but it is correct, and it
-- is the policy that should govern if direct client writes are ever introduced.

-- ── 3. Verification ─────────────────────────────────────────────────────────
-- After running, this should return only SELECT policies plus "Profiles self update":
--
--   SELECT tablename, policyname, roles, cmd, qual
--     FROM pg_policies
--    WHERE tablename IN ('profiles', 'demo_club_data')
--    ORDER BY tablename, cmd;
--
-- And this should fail with 401/403 rather than returning a mutated row:
--
--   curl -X PATCH "$SUPABASE_URL/rest/v1/demo_club_data?id=eq.<uuid>" \
--     -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
--     -d '{"club_description":"rls probe"}'

COMMIT;
