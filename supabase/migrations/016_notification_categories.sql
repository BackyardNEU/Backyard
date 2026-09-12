-- Standardise entity_type to the three UI categories: 'club' | 'user' | 'other'.
-- Previously entity_type held fine-grained values like 'club_event', 'review',
-- 'friend_request', 'club_announcement', or the legacy 'club'. It now doubles as the
-- category discriminator used by the panel grouping and avatar-nav logic.
UPDATE notifications
SET entity_type = CASE
  WHEN type IN ('friend_request', 'friend_accepted')               THEN 'user'
  WHEN type IN ('new_club_event', 'new_review', 'club_announcement') THEN 'club'
  ELSE 'other'
END;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_entity_type_check
  CHECK (entity_type IN ('club', 'user', 'other'));

CREATE INDEX IF NOT EXISTS notifications_recipient_entity_type
  ON notifications (recipient_id, entity_type, created_at DESC);
