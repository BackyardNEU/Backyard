import express from 'express';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { checkMuted } from '../middleware/checkMuted.js';
import textModerator from '../lib/textModerator.js';

const router = express.Router();

router.use(requireAuth);

// GET /api/events/weekly  — events for clubs the current user has favorited.
// Uses the existing get_weekly_events Postgres function.
router.get('/weekly', async (req, res) => {
    const { data, error } = await supabaseAdmin
        .rpc('get_weekly_events', { p_user_id: req.user.id });

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    res.json(data);
});

// GET /api/events/rsvps?eventIds=a,b,c
// Returns ALL RSVPs for those events, not just the current user's — the
// CalendarPage needs this to render friend avatars on each event card.
// If RSVPs should ever be private, this needs to scope to the user + their
// friend_list.
router.get('/rsvps', async (req, res) => {
    const idsParam = req.query.eventIds;
    if (!idsParam) return res.json([]);

    const ids = String(idsParam).split(',').filter(Boolean);
    if (ids.length === 0) return res.json([]);

    const { data, error } = await supabaseAdmin
        .from('attendees')
        .select('user_id, event_id')
        .in('event_id', ids);

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    res.json(data);
});

// Server-side validation — the frontend does this too, but never trust it.
function validateEventFields(body) {
    const { description, startTime, endTime } = body || {};
    if (!startTime || !endTime) {
        return 'Missing required fields: startTime, endTime';
    }
    if (description && description.length > 200) return 'Description must be 200 characters or fewer';

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (isNaN(start) || isNaN(end)) return 'Invalid start or end time';
    if (start >= end) return 'startTime must be before endTime';
    if (end - start > 12 * 60 * 60 * 1000) return 'Event cannot exceed 12 hours';
    if (start < new Date()) return 'Event cannot start in the past';

    return null;
}

function validateEvent(body) {
    const { clubId, clubName } = body || {};
    if (!clubId || !clubName) return 'Missing required fields: clubId, clubName';
    return validateEventFields(body);
}

// Shared by PUT/DELETE — confirms the event exists and the current user is a
// member of the club that owns it (same permission model as creating events:
// any approved club editor, not just the original creator).
async function requireClubMembershipForEvent(req, res) {
    const { data: existing, error: fetchError } = await supabaseAdmin
        .from('club_events')
        .select('id_of_club')
        .eq('id', req.params.eventId)
        .single();

    if (fetchError || !existing) {
        res.status(404).json({ error: 'Event not found' });
        return null;
    }

    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('member_list')
        .eq('id', req.user.id)
        .single();

    const memberList = profile?.member_list || [];
    if (!memberList.includes(existing.id_of_club)) {
        res.status(403).json({ error: 'You must be a member of this club to modify its events' });
        return null;
    }

    return existing;
}

router.post('/', checkMuted, async (req, res) => {
    const validationError = validateEvent(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    // event_name and where are written to club_events and render prominently on the
    // calendar, but only description used to be moderated — leaving two user-controlled
    // text fields unchecked.
    const textCheck = textModerator.checkFields({
        description: req.body.description,
        event_name: req.body.eventName,
        where: req.body.where,
    });
    if (!textCheck.clean) {
        return res.status(400).json({ error: textCheck.message, field: textCheck.field });
    }

    const {
        clubId, clubName, description, startTime, endTime, imageUrl,
        // eventName, where and isMembersOnly are used below but were missing from this
        // destructure, so every POST threw ReferenceError before reaching the insert.
        eventName, where, isMembersOnly,
    } = req.body;

    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('member_list')
        .eq('id', req.user.id)
        .single();

    const memberList = profile?.member_list || [];
    if (!memberList.includes(clubId)) {
        return res.status(403).json({ error: 'You must be a member of this club to create events' });
    }

    const insert = {
        id_of_club: clubId,
        club_name: clubName,
        event_description: description,
        start_time: startTime,
        end_time: endTime,
        is_members_only: isMembersOnly === true,
    };
    if (imageUrl) insert.event_image_url = imageUrl;
    if (eventName) insert.event_name = eventName;
    if (where) insert.where = where;

    const { data, error } = await supabaseAdmin
        .from('club_events')
        .insert(insert)
        .select()
        .single();

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    res.status(201).json(data);
});

router.put('/:eventId', checkMuted, async (req, res) => {
    const validationError = validateEventFields(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    // The edit path had no moderation and no mute check at all, so a member could post a
    // clean event and immediately edit it to say anything.
    const textCheck = textModerator.checkFields({
        description: req.body.description,
        event_name: req.body.eventName,
        where: req.body.where,
    });
    if (!textCheck.clean) {
        return res.status(400).json({ error: textCheck.message, field: textCheck.field });
    }

    const existing = await requireClubMembershipForEvent(req, res);
    if (!existing) return;

    const { eventName, description, where, startTime, endTime, imageUrl, isMembersOnly } = req.body;

    const update = {
        event_description: description,
        start_time: startTime,
        end_time: endTime,
        is_members_only: isMembersOnly === true,
        event_image_url: imageUrl || null,
        event_name: eventName || null,
        where: where || null,
    };

    const { data, error } = await supabaseAdmin
        .from('club_events')
        .update(update)
        .eq('id', req.params.eventId)
        .select()
        .single();

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    res.json(data);
});

router.delete('/:eventId', async (req, res) => {
    const existing = await requireClubMembershipForEvent(req, res);
    if (!existing) return;

    const { error } = await supabaseAdmin
        .from('club_events')
        .delete()
        .eq('id', req.params.eventId);

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    res.status(204).end();
});

router.post('/:eventId/rsvp', checkMuted, async (req, res) => {
    const { error } = await supabaseAdmin
        .from('attendees')
        .upsert(
            { user_id: req.user.id, event_id: req.params.eventId },
            { onConflict: 'user_id,event_id', ignoreDuplicates: true }
        );

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    res.status(204).end();
});

router.delete('/:eventId/rsvp', async (req, res) => {
    const { error } = await supabaseAdmin
        .from('attendees')
        .delete()
        .eq('user_id', req.user.id)
        .eq('event_id', req.params.eventId);

    if (error) {
        const err = new Error(error.message);
        err.status = 502;
        throw err;
    }

    res.status(204).end();
});

export default router;
