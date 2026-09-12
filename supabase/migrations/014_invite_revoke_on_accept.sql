-- Add revoke_on_accept flag to editor invite links.
-- When true the link is auto-revoked after the first successful redemption,
-- preventing reuse by other people while still tolerating email-client previews.
ALTER TABLE club_invite_links
  ADD COLUMN IF NOT EXISTS revoke_on_accept boolean NOT NULL DEFAULT true;

-- Replace consume_invite_link to atomically revoke editor links on first accept.
-- The FOR UPDATE lock already serialises concurrent redeems, so setting is_revoked
-- inside the function closes the race window that existed when the revoke was done
-- in application code after the RPC returned.
CREATE OR REPLACE FUNCTION consume_invite_link(p_token_hash text, p_user_id uuid)
RETURNS TABLE (link_id uuid, club_id uuid, link_type text, first_use boolean)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
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

  -- Atomically revoke editor links marked revoke_on_accept so no concurrent
  -- redeem can slip through between the RPC returning and the app-layer revoke.
  IF v_link.link_type = 'editor' AND v_link.revoke_on_accept THEN
    UPDATE club_invite_links SET is_revoked = true WHERE id = v_link.id;
  END IF;

  RETURN QUERY SELECT v_link.id, v_link.club_id, v_link.link_type, true;
END $$;
