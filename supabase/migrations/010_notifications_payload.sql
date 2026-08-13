-- Add a payload column to notifications for type-specific metadata
-- (e.g. club name and icon URL for new_club_event notifications).
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS payload jsonb;
