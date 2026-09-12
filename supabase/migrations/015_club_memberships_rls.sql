-- Tighten club_memberships write access.
--
-- 002 added one INSERT policy, described in its own comment as "defense-in-depth"
-- because supabaseAdmin bypasses RLS. That framing is what made it too loose: the API
-- is not the only way in. anon and authenticated hold write grants on this table and
-- the anon key ships in the browser bundle, so for a direct PostgREST call this policy
-- is not a second layer — it is the only one.
--
-- What it checked: that the row's user and the row's club share a school string.
-- What it did not check:
--   * that the row's user_id is the caller (no auth.uid() reference at all),
--   * that role is 'member' — the column is a club_role enum, so the privileged
--     values are as insertable as the default,
--   * that the caller is authenticated (no TO clause, so anon is included).
--
-- club_memberships.role is what requireModerator reads, and what gates page edits,
-- invite minting, member removal, ownership transfer and announcements. This is the
-- authoritative role table per CLAUDE.md, so its write path needs to match.
--
-- 011_rls_hardening.sql fixed this class of hole on profiles and demo_club_data and
-- documented the reasoning; this table was not in its scope.

-- Same school gate as before, plus the three missing conditions. Kept as a policy
-- rather than dropped entirely so a future client-side join still has a correct path.
DROP POLICY IF EXISTS "members can only join clubs at their own school" ON club_memberships;

CREATE POLICY "members join their own school's clubs as members"
ON club_memberships
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'member'
  AND (SELECT school FROM profiles WHERE id = user_id)
      = (SELECT school FROM demo_club_data WHERE id = club_id)
);

-- The grants are the actual exposure. Every mutation to this table goes through the
-- Express API on the service-role key, which bypasses RLS entirely, so removing these
-- costs the application nothing and removes the capability from everyone else. This is
-- the deny-all shape docs/schema.md describes as the intended pattern for tables the
-- API owns.
REVOKE INSERT, UPDATE, DELETE ON club_memberships FROM anon, authenticated;

-- club_custom_roles carries the display labels and the grants_moderator_privileges
-- flag. Its policy is correctly scoped (it checks auth.uid() against the caller's own
-- membership row), but it inherits the same blanket grants, and it is only as strong as
-- the membership rows it reads.
REVOKE INSERT, UPDATE, DELETE ON club_custom_roles FROM anon, authenticated;
