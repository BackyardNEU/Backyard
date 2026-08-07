-- Account deletion.
--
-- Everything runs inside one function so it is atomic — a half-deleted account is far
-- worse than a failed deletion. The caller (DELETE /api/me/account) invokes this, then
-- calls auth.admin.deleteUser() to remove the auth row itself.
--
-- The part that does NOT happen automatically: profiles.friend_list is a plain uuid[]
-- with no foreign key, so nothing cascades it. Without the array_remove below, every
-- friend of a deleted user keeps their id embedded forever, and GET /api/me/friends would
-- keep trying to resolve a profile that no longer exists.
-- (profiles.member_list holds club ids, not user ids, so it needs no cleanup.)
--
-- Several of these tables already cascade from auth.users (club_memberships, user_blocks,
-- content_strikes) or from profiles (user_favorites). Deleting explicitly is harmless and
-- keeps the function correct regardless of how the live FK graph actually looks — the
-- repo has no migration for most of these tables, so their constraints cannot be assumed.
--
-- Idempotent; safe to re-run.

CREATE OR REPLACE FUNCTION delete_user_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  -- Reviews are anonymized rather than deleted. Club pages are built from reviews, so
  -- removing them punishes the club rather than the departing user; the text is content
  -- about a club, not personal data, and it has already passed moderation. Detaching
  -- user_id is what makes it no longer personal data.
  -- To hard-delete instead, replace this with:
  --   DELETE FROM reviews WHERE user_id = p_user_id;
  IF to_regclass('public.reviews') IS NOT NULL THEN
    UPDATE reviews SET user_id = NULL WHERE user_id = p_user_id;
  END IF;

  -- The uuid[] with no FK. Must run before the profile row goes.
  UPDATE profiles
     SET friend_list = array_remove(friend_list, p_user_id)
   WHERE friend_list @> ARRAY[p_user_id];

  -- Rows keyed by the user, in dependency order.
  IF to_regclass('public.friend_requests') IS NOT NULL THEN
    DELETE FROM friend_requests WHERE sender_id = p_user_id OR recipient_id = p_user_id;
  END IF;

  IF to_regclass('public.notifications') IS NOT NULL THEN
    DELETE FROM notifications WHERE recipient_id = p_user_id OR actor_id = p_user_id;
  END IF;

  IF to_regclass('public.notification_preferences') IS NOT NULL THEN
    DELETE FROM notification_preferences WHERE user_id = p_user_id;
  END IF;

  IF to_regclass('public.user_blocks') IS NOT NULL THEN
    DELETE FROM user_blocks WHERE blocker_id = p_user_id OR blocked_id = p_user_id;
  END IF;

  IF to_regclass('public.user_favorites') IS NOT NULL THEN
    DELETE FROM user_favorites WHERE user_id = p_user_id;
  END IF;

  IF to_regclass('public.user_votes') IS NOT NULL THEN
    DELETE FROM user_votes WHERE user_id = p_user_id;
  END IF;

  IF to_regclass('public.attendees') IS NOT NULL THEN
    DELETE FROM attendees WHERE user_id = p_user_id;
  END IF;

  IF to_regclass('public.user_faqs') IS NOT NULL THEN
    DELETE FROM user_faqs WHERE user_id = p_user_id;
  END IF;

  IF to_regclass('public.support_tickets') IS NOT NULL THEN
    DELETE FROM support_tickets WHERE user_id = p_user_id;
  END IF;

  IF to_regclass('public.club_memberships') IS NOT NULL THEN
    DELETE FROM club_memberships WHERE user_id = p_user_id;
  END IF;

  IF to_regclass('public.content_strikes') IS NOT NULL THEN
    DELETE FROM content_strikes WHERE user_id = p_user_id;
  END IF;

  IF to_regclass('public.approved_club_accounts') IS NOT NULL THEN
    DELETE FROM approved_club_accounts WHERE user_id = p_user_id;
  END IF;

  -- Last: the profile itself. auth.users is removed by the caller via the admin API.
  DELETE FROM profiles WHERE id = p_user_id;
END;
$$;

-- Only the service role should ever call this. The API reaches it through supabaseAdmin
-- after verifying the JWT, so end users must not be able to invoke it directly and pass
-- somebody else's id.
REVOKE ALL ON FUNCTION delete_user_account(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_user_account(uuid) FROM anon;
REVOKE ALL ON FUNCTION delete_user_account(uuid) FROM authenticated;
