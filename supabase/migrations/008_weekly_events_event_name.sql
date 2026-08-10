-- get_weekly_events was missing event_name entirely, so the calendar's weekly
-- view and the lightbox opened from it could only ever show the club name in
-- their title, never "{club name} • {event name}" like the monthly lightbox.
-- It also returned id_of_club with no club_id alias, while every frontend
-- consumer (RSVP visibility check, club-image fallback lookup) reads
-- event.club_id — so that data was always undefined for weekly events.
--
-- CREATE OR REPLACE FUNCTION cannot change a function's output columns, so
-- the old signature has to be dropped first.
DROP FUNCTION IF EXISTS get_weekly_events(uuid);

CREATE FUNCTION get_weekly_events(p_user_id uuid)
RETURNS TABLE (
    id uuid,
    id_of_club uuid,
    club_id uuid,
    club_name text,
    event_name text,
    event_description text,
    start_time timestamp,
    end_time timestamp,
    image_url text
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        ce.id,
        ce.id_of_club,
        ce.id_of_club AS club_id,
        ce.club_name,
        ce.event_name,
        ce.event_description,
        ce.start_time,
        ce.end_time,
        COALESCE(ce.event_image_url, dc.image_url) AS image_url
    FROM club_events ce
    JOIN demo_club_data dc ON dc.id = ce.id_of_club
    WHERE ce.id_of_club = ANY (
        SELECT unnest(member_list)
        FROM profiles
        WHERE id = p_user_id
    )
    AND ce.end_time >= now()
    AND ce.start_time < now() + interval '7 days';
$$;
