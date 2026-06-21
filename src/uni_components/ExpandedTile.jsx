import React, { useState, useEffect, useCallback } from "react";
// eslint-disable-next-line no-unused-vars
import { motion } from "framer-motion";
import ReviewPage from "../review_components/ReviewPage";
import "./ExpandedTile.css";
import ReviewList from "../review_components/ReviewList";
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import logImage from '/src/assets/logImage.png';
import heartEmpty from '/src/assets/empty_heart.png';
import heartFull from '/src/assets/full_heart.png';
import BasicInfoModule from '../club_page_components/BasicInfoModule';
import JoinModule from '../club_page_components/JoinModule';
import StatsModule from '../club_page_components/StatsModule';
import ClubMediaModule from '../club_page_components/ClubMediaModule';
import FaqModule from '../club_page_components/FaqModule';
import MemberRosterModule from '../club_page_components/MemberRosterModule';
import { CalendarModule } from '../club_page_components/CalendarModule';
import { useClubData } from '../context/useClubData';
import { useGlobalStore } from '../lib/store';

// --- Validation helpers ---
function validateBasicInfo(data) {
    if (!data?.club_name?.trim()) return 'Club name cannot be empty.';
    if (data.club_name.trim().length > 80) return 'Club name must be 80 characters or fewer.';
    if (!data?.description?.trim()) return 'Description cannot be empty.';
    return null;
}

function validateJoin(data) {
    const tabs = data?.tabs ?? [];
    for (const tab of tabs) {
        if (!tab.title?.trim()) return 'Each tab must have a title.';
        if (tab.title.trim().length > 60) return 'Tab titles must be 60 characters or fewer.';
        if (!tab.body?.trim()) return 'Each tab must have body text.';
        if (tab.body.trim().length > 500) return 'Tab body must be 500 characters or fewer.';
    }
    return null;
}

function validateStats(data) {
    const stats = data?.stats ?? [];
    for (const s of stats) {
        if (s.value < 0) return 'Stat values cannot be negative.';
        if (s.value % 1 !== 0) return 'Stat value must be a whole number.';
        if (s.type === 'quantitative') {
            if (!s.unit1?.trim() || !s.unit2?.trim()) return 'Each quantitative stat must have a unit.';
        }
        if (s.type === 'qualitative') {
            if (!s.label?.trim()) return 'Each qualitative stat must have a name.';
            const max = s.max ?? 10;
            if (max < 1) return 'Max must be at least 1.';
            if (s.value > max) return 'A stat value exceeds its max.';
            if (max % 1 !== 0) return 'Max must be a whole number.';
        }
    }
    return null;
}

function validateFaq(data) {
    const faqs = data?.faqs ?? [];
    for (const f of faqs) {
        if (!f.q?.trim()) return 'Each FAQ must have a question.';
        if (f.q.trim().length > 200) return 'FAQ questions must be 200 characters or fewer.';
        if (f.a && f.a.length > 500) return 'FAQ answers must be 500 characters or fewer.';
    }
    return null;
}

function validateMemberRoster(data) {
    const categories = data?.categories ?? [];
    const members = data?.members ?? [];
    for (const c of categories) {
        if (!c?.trim()) return 'Category names cannot be empty.';
        if (c.trim().length > 25) return 'Category names must be 25 characters or fewer.';
    }
    for (const m of members) {
        if (!m.name?.trim()) return 'Each member must have a name.';
        if (m.name.trim().length > 50) return 'Member names must be 50 characters or fewer.';
        const bioText = (m.bio || '').replace(/<[^>]*>/g, '');
        if (bioText.length > 500) return 'Member bios must be 500 characters or fewer.';
    }
    return null;
}

function validateCalendar(_data) {
    // module.data stores only settings (filterByMembership); events live in the DB
    return null;
}

function validateClubMedia(data) {
    const posters = data?.posters ?? [];
    for (const p of posters) {
        if (p.poster_text && p.poster_text.length > 100) return 'Poster titles must be 100 characters or fewer.';
        for (const block of (p.content ?? [])) {
            if (block.type === 'title' && block.value && block.value.length > 100) return 'Content headings must be 100 characters or fewer.';
            if (block.type === 'text' && block.value && block.value.length > 500) return 'Content text must be 500 characters or fewer.';
        }
    }
    return null;
}

function getModuleWarnings(draft) {
    const w = {};
    for (const m of draft) {
        if (m.type === 'basic_info') w.basic_info = validateBasicInfo(m.data);
        if (m.type === 'join') w.join = validateJoin(m.data);
        if (m.type === 'stats') w.stats = validateStats(m.data);
        if (m.type === 'faqs') w.faqs = validateFaq(m.data);
        if (m.type === 'member_roster') w.member_roster = validateMemberRoster(m.data);
        if (m.type === 'club_media') w.club_media = validateClubMedia(m.data);
        if (m.type === 'calendar') w.calendar = validateCalendar(m.data);
    }
    return w;
}


function ExpandedTile({ club, onClose, onMembershipChange }) {
    // determines when to begin the data requesting- animationDone triggers most data requests here
    const [animationDone, setAnimationDone] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [reviews, set_reviews] = useState([]);
    const [isClicked, setIsClicked] = useState(false);
    // records the user itself
    const [user, setUser] = useState(null);
    // determines if someone is a member of a club- derived from supabase table
    const [isMember, setIsMember] = useState(false);
    // NOTE2SELF: THIS WILL BECOME IRRELEVANT LATER AS A LOADING STATE ACROSS ALL MODULES/INFO IS PUT IN PLACE
    const [memberLoading, setMemberLoading] = useState(false);
    // determines if a user is an approved club account- derived from auth
    const [isApproved, setIsApproved] = useState(false);
    // info from modules data to be displayed from db
    const [pageData, setPageData] = useState(null);
    // top tags derived from reviews
    const [topTags, setTopTags] = useState([]);
    // editing state for changing modules
    const [isEditing, setIsEditing] = useState(false);
    // copy of the pageData.modules array initially so that it can record changes aggregated over all the modules
    const [draft, setDraft] = useState([]);
    // determines state of saving progress from changes
    const [isSaving, setIsSaving] = useState(false);
    // determines if a new logo has been uploaded- requires a new signed URL upload to the supabase storage bucket
    const [pendingLogoFile, setPendingLogoFile] = useState(null);
    // favorites heart — mirrors the behavior in ClubGrid
    const [heartAnimating, setHeartAnimating] = useState(false);
    // pending user-submitted FAQ questions (approved editors only) + ids to delete on Save
    const [userFaqs, setUserFaqs] = useState([]);
    const [questionDeletes, setQuestionDeletes] = useState(() => new Set());
    // club events (for the calendar module)
    const [clubEvents, setClubEvents] = useState([]);
    const [clubMyRsvpSet, setClubMyRsvpSet] = useState(new Set());
    const [clubFriendRsvpMap, setClubFriendRsvpMap] = useState(new Map());

    const id = club.id;

    const { favoritesCache, invalidateFavoritesCache, friendsArray } = useClubData();
    const GlobalValue = useGlobalStore((state) => state.GlobalValue);
    const liked = favoritesCache?.has(club.id) ?? false;

    const handleHeartClick = async (e) => {
        e.stopPropagation();
        setHeartAnimating(true);
        const newLiked = !liked;
        try {
            if (newLiked) {
                await apiFetch('/me/favorites', { method: 'POST', body: { club_id: club.id } });
                invalidateFavoritesCache(club.id, true);
            } else {
                await apiFetch(`/me/favorites/${club.id}`, { method: 'DELETE' });
                invalidateFavoritesCache(club.id, false);
            }
        } catch (err) {
            console.error(`Error ${newLiked ? 'adding' : 'removing'} favorite:`, err);
        }
        setTimeout(() => setHeartAnimating(false), 250);
    };

    const handleClose = useCallback(() => {
        setIsClosing(true);
        onClose();
    }, [onClose]);

    useEffect(() => {
        const handler = (e) => {
            if (e.key === "Escape") handleClose();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [handleClose]);

    const handleClick = () => {
        setIsOpen(!isOpen);
        setIsClicked(true);
        setTimeout(() => setIsClicked(false), 350);
    };

    useEffect(() => {
        if (!animationDone) return;

        async function fetchAll() {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            setUser(authUser ?? null);

            const publicFetches = [
                apiFetch(`/clubs/${id}/reviews`, { auth: false }),
                apiFetch(`/clubs/${id}/page`, { auth: false }),
                apiFetch(`/clubs/${id}/top-tags`, { auth: false }),
                apiFetch(`/clubs/${id}/events`), // optional auth: sends token if logged in
            ];
            const authFetches = authUser ? [
                apiFetch('/me/membership'),
                apiFetch(`/clubs/${id}/is-approved`),
            ] : [];

            console.log("Awaiting info...");

            const [reviewsResult, pageResult, topTagsResult, eventsResult, membershipResult, approvedResult] =
                await Promise.allSettled([...publicFetches, ...authFetches]);

            if (reviewsResult.status === 'fulfilled') set_reviews(reviewsResult.value);
            if (topTagsResult.status === 'fulfilled') setTopTags((topTagsResult.value || []).map(r => r.tag));
            if (eventsResult.status === 'fulfilled') {
                const eventsData = eventsResult.value || [];
                setClubEvents(eventsData);
                if (eventsData.length > 0 && authUser) {
                    try {
                        const eventIds = eventsData.map((e) => e.id);
                        const rsvpData = await apiFetch(`/clubs/${id}/events/rsvps?eventIds=${eventIds.join(',')}`);
                        setClubMyRsvpSet(new Set(
                            rsvpData.filter((r) => r.user_id === authUser.id).map((r) => r.event_id)
                        ));
                        const friendIdSet = new Set((friendsArray || []).map((f) => f.id));
                        const friendProfileMap = new Map((friendsArray || []).map((f) => [f.id, f]));
                        const newFriendRsvpMap = new Map();
                        for (const rsvp of rsvpData) {
                            if (friendIdSet.has(rsvp.user_id)) {
                                if (!newFriendRsvpMap.has(rsvp.event_id)) newFriendRsvpMap.set(rsvp.event_id, []);
                                newFriendRsvpMap.get(rsvp.event_id).push(friendProfileMap.get(rsvp.user_id));
                            }
                        }
                        setClubFriendRsvpMap(newFriendRsvpMap);
                    } catch (err) {
                        console.error('Failed to fetch club RSVPs:', err);
                    }
                }
            }
            if (pageResult.status === 'fulfilled') {
                setPageData(pageResult.value);
                // if no page row exists yet, seed a default basic_info module from base club data
                const modules = pageResult.value?.modules;
                setDraft(modules?.length > 0 ? modules : [{
                    type: 'basic_info',
                    order: 0,
                    data: {
                        club_name: club.club_name || '',
                        logo_url: club.image_url || '/raccoon_pfp.png',
                        description: club.club_description || '',
                    }
                }]);
                console.log("Success retrieving data!");
            }
            if (membershipResult?.status === 'fulfilled')
                setIsMember((membershipResult.value?.member_list || []).includes(id));
            if (approvedResult?.status === 'fulfilled')
                setIsApproved(approvedResult.value?.approved ?? false);
        }

        fetchAll();
    }, [id, animationDone, club]);

    // Approved editors: load the club's pending user-submitted FAQ questions.
    useEffect(() => {
        if (!isApproved) return;
        let alive = true;
        apiFetch(`/clubs/${id}/questions`)
            .then((qs) => { if (alive) setUserFaqs(qs || []); })
            .catch(() => {});
        return () => { alive = false; };
    }, [isApproved, id]);

    async function handleMembership() {
        if (!user || memberLoading) return;
        setMemberLoading(true);
        try {
            const { member_list } = await apiFetch('/me/membership');
            let list = member_list || [];
            // check if user is currently a member of the club (if the club's id can be found in the list of club id's under 
            // the member_list arrary column in profiles).
            if (isMember) {
                list = list.filter((cid) => cid !== club.id);
            } else {
                // otherwise, add clubId to user's membership list of clubs they belong to
                list = [...list, club.id];
            }
            // updates user member_list
            await apiFetch('/me/membership', { method: 'PUT', body: { member_list: list } });
            const wasJoined = isMember;
            setIsMember(!isMember);
            if (onMembershipChange) onMembershipChange(club.id, !wasJoined);
        } catch (err) {
            console.error('Error updating membership:', err);
        }
        setMemberLoading(false);
    }

    const handleModuleChange = useCallback((type, updatedData) => {
        setDraft(prev => prev.map(m =>
            m.type === type ? { ...m, data: updatedData } : m
        ));
    }, []);

    const handleClubRsvp = async (eventId, isCurrentlyGoing) => {
        if (!user) return;
        try {
            if (isCurrentlyGoing) {
                await apiFetch(`/clubs/${id}/events/${eventId}/rsvp`, { method: 'DELETE' });
                setClubMyRsvpSet((prev) => { const next = new Set(prev); next.delete(eventId); return next; });
            } else {
                await apiFetch(`/clubs/${id}/events/${eventId}/rsvp`, { method: 'POST' });
                setClubMyRsvpSet((prev) => new Set([...prev, eventId]));
            }
        } catch (err) {
            console.error('RSVP failed:', err);
        }
    };

    const handleAddEvent = async (eventData) => {
        await apiFetch('/events', {
            method: 'POST',
            body: {
                clubId: id,
                clubName: club.club_name,
                description: eventData.description,
                startTime: eventData.startTime,
                endTime: eventData.endTime,
                imageUrl: eventData.imageUrl ?? undefined,
            },
        });
        // Refresh events after adding
        const events = await apiFetch(`/clubs/${id}/events`);
        setClubEvents(events || []);
    };

    const moduleWarnings = isEditing ? getModuleWarnings(draft) : {};
    const isDraftValid = Object.values(moduleWarnings).every(w => w == null);
    // Accept a user question: append {q,a} to the faqs module draft and mark the row to delete on Save.
    const onAcceptQuestion = useCallback((qid, answer) => {
        const q = userFaqs.find((x) => x.id === qid);
        if (!q) return;
        setDraft(prev => prev.map(m =>
            m.type === 'faqs'
                ? { ...m, data: { ...m.data, faqs: [...(m.data?.faqs || []), { q: q.question, a: answer }] } }
                : m
        ));
        setQuestionDeletes(prev => new Set(prev).add(qid));
    }, [userFaqs]);

    // Dismiss a user question: mark the row to delete on Save.
    const onDeleteQuestion = useCallback((qid) => {
        setQuestionDeletes(prev => new Set(prev).add(qid));
    }, []);

    const handleSave = async () => {
        if (!isDraftValid) return;
        setIsSaving(true);
        let finalDraft = draft;
        try {
            if (pendingLogoFile) {
                const { signedUrl, publicUrl } = await apiFetch('/storage/club-logo-upload-url', {
                    method: 'POST',
                    body: { club_id: id, ext: pendingLogoFile.type.split('/')[1] },
                });
                await fetch(signedUrl, { method: 'PUT', body: pendingLogoFile });
                finalDraft = draft.map(m =>
                    m.type === 'basic_info' ? { ...m, data: { ...m.data, logo_url: publicUrl } } : m
                );
            }
            await apiFetch(`/clubs/${id}/page`, {
                method: 'PUT',
                body: { modules: finalDraft },
            });
            setPageData(prev => ({ ...prev, modules: finalDraft }));
            setDraft(finalDraft);

            // Commit accepted/dismissed FAQ questions: delete their rows now that the page is saved.
            if (questionDeletes.size) {
                await Promise.allSettled(
                    [...questionDeletes].map((qid) =>
                        apiFetch(`/clubs/${id}/questions/${qid}`, { method: 'DELETE' })
                    )
                );
                setUserFaqs((prev) => prev.filter((q) => !questionDeletes.has(q.id)));
                setQuestionDeletes(new Set());
            }

            setIsEditing(false);
            setPendingLogoFile(null);
        } catch (err) {
            console.error('Error saving:', err);
        } finally {
            setIsSaving(false);
        }
    };

    // for the cancel button- disables editing and reverts the draft back to the current state of the data
    const handleCancel = () => {
        setDraft(pageData?.modules ?? []);
        setPendingLogoFile(null);
        setQuestionDeletes(new Set()); // restore optimistically-removed questions
        setIsEditing(false);
    };

    // Action row rendered inside the basic_info module (between the banner and the About text)
    const actionRow = (
        <div className="exp-action-row">
            <div className="exp-action-row-inner">
                {isClicked
                    ? <img src={logImage} className="log-btn" alt="Clicked state" />
                    : <button className="review-btn" onClick={handleClick}>Share your experience</button>
                }

                {user && (
                    <button
                        className={`membership-btn ${isMember ? 'leave' : 'join'}`}
                        onClick={handleMembership}
                        disabled={memberLoading}
                    >
                        {memberLoading ? '...' : isMember ? 'Leave Club' : 'Join Club'}
                    </button>
                )}

                {/* Placeholder — event creation to be wired up later */}
                <button className="add-events-btn" type="button">Add Events</button>

                {GlobalValue && (
                    <img
                        className={`exp-action-heart ${heartAnimating ? 'pop' : ''}`}
                        src={liked ? heartFull : heartEmpty}
                        onClick={handleHeartClick}
                        alt={liked ? 'Remove favorite' : 'Add favorite'}
                    />
                )}
            </div>
        </div>
    );

    return (
        <motion.div
            layoutId={`club-${club.id}`}
            className="expanded-card"
            style={{ pointerEvents: isClosing ? "none" : "auto" }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            onAnimationComplete={() => setAnimationDone(true)}
        >
            <button className="close-btn" onClick={handleClose}>x</button>

            {isApproved && !isEditing && (
                <button className="exp-edit-btn" onClick={() => setIsEditing(true)}>Edit Page</button>
            )}

            <div className="club-modules">
            {(draft ?? [])
                .sort((a, b) => a.order - b.order)
                .map(module => {
                    if (module.type === 'basic_info') return (
                        <BasicInfoModule
                            key="basic_info"
                            club={club}
                            data={module.data}
                            topTags={topTags}
                            editing={isEditing}
                            onChange={(updatedData) => handleModuleChange('basic_info', updatedData)}
                            onLogoChange={(file) => setPendingLogoFile(file)}
                            actions={actionRow}
                            warning={moduleWarnings.basic_info ?? null}
                        />
                    );
                    if (module.type === 'join') return (
                        <JoinModule
                            key="join"
                            club={club}
                            data={module.data}
                            editing={isEditing}
                            onChange={(updatedData) => handleModuleChange('join', updatedData)}
                            warning={moduleWarnings.join ?? null}
                        />
                    );
                    if (module.type === 'stats') return (
                        <StatsModule
                            key="stats"
                            data={module.data}
                            editing={isEditing}
                            onChange={(updatedData) => handleModuleChange('stats', updatedData)}
                            warning={moduleWarnings.stats ?? null}
                        />
                    );
                    if (module.type === 'club_media') return (
                        <ClubMediaModule
                            key="club_media"
                            data={module.data}
                            editing={isEditing}
                            warning={moduleWarnings.club_media ?? null}
                            onChange={(updatedData) => handleModuleChange('club_media', updatedData)}
                        />
                    );
                    if (module.type === 'faqs') return (
                        <FaqModule
                            key="faqs"
                            club={club}
                            data={module.data}
                            editing={isEditing}
                            onChange={(updatedData) => handleModuleChange('faqs', updatedData)}
                            warning={moduleWarnings.faqs ?? null}
                            canAsk={!!user && !isApproved}
                            userQuestions={userFaqs.filter((q) => !questionDeletes.has(q.id))}
                            onAcceptQuestion={onAcceptQuestion}
                            onDeleteQuestion={onDeleteQuestion}
                        />
                    );
                    if (module.type === 'member_roster') return (
                        <MemberRosterModule
                            key="member_roster"
                            club={club}
                            data={module.data}
                            editing={isEditing}
                            onChange={(updatedData) => handleModuleChange('member_roster', updatedData)}
                            warning={moduleWarnings.member_roster ?? null}
                        />
                    );
                    if (module.type === 'calendar') return (
                        <CalendarModule
                            key="calendar"
                            data={module.data}
                            editing={isEditing}
                            isApproved={isApproved}
                            onChange={(updatedData) => handleModuleChange('calendar', updatedData)}
                            warning={moduleWarnings.calendar ?? null}
                            events={clubEvents}
                            myRsvpSet={clubMyRsvpSet}
                            friendRsvpMap={clubFriendRsvpMap}
                            onRsvp={handleClubRsvp}
                            onAddEvent={handleAddEvent}
                            userId={user?.id ?? null}
                        />
                    );
                })}
            </div>

            {isApproved && isEditing && (
                <div className="expanded-edit-actions">
                    <button onClick={handleCancel} disabled={isSaving}>Cancel</button>
                    <button className="save-btn" onClick={handleSave} disabled={isSaving || !isDraftValid}>
                        {isSaving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            )}

            <div className="content-col-divider">
                <div className="divider"></div>
            </div>

            <div className="view-reviews">
                <ReviewList reviews={reviews} club={club} />
            </div>

            {isOpen && (
                <div>
                    <ReviewPage clubId={club.id} onClose={() => setIsOpen(false)} />
                </div>
            )}
        </motion.div>
    );
}

export default ExpandedTile;
