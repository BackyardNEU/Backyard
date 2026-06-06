import React, { useState, useEffect, useCallback } from "react";
// eslint-disable-next-line no-unused-vars
import { motion } from "framer-motion";
import ReviewPage from "../review_components/ReviewPage";
import "./ExpandedTile.css";
import ReviewList from "../review_components/ReviewList";
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import logImage from '/src/assets/logImage.png';
import BasicInfoModule from '../club_page_components/BasicInfoModule';


function ExpandedTile({ club, onClose, onMembershipChange }) {
    // determines when to begin the data requesting- animationDone triggers most data requests here
    const [animationDone, setAnimationDone] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [reviews, set_reviews] = useState([]);
    const [isClicked, setIsClicked] = useState(false);
    const [club_stats, setClubStats] = useState(null);
    // records the user itself
    const [user, setUser] = useState(null);
    // determines if someone is a member of a club- derived from supabase table
    const [isMember, setIsMember] = useState(false);
    // NOTE2SELF: THIS WILL BECOME IRRELEVANT LATER AS A LOADING STATE ACROSS ALL MODULES/INFO IS PUT IN PLACE
    const [memberLoading, setMemberLoading] = useState(false);
    // determines if a user is an approved club account- derived from auth
    const [isApproved, setIsApproved] = useState(false);
    // requested modules data to be displayed from db
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

    const id = club.id;

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
                apiFetch(`/clubs/${id}/stats`, { auth: false }),
                apiFetch(`/clubs/${id}/page`, { auth: false }),
                apiFetch(`/clubs/${id}/top-tags`, { auth: false }),
            ];
            const authFetches = authUser ? [
                apiFetch('/me/membership'),
                apiFetch(`/clubs/${id}/is-approved`),
            ] : [];

            console.log("Awaiting info...");

            const [reviewsResult, statsResult, pageResult, topTagsResult, membershipResult, approvedResult] =
                await Promise.allSettled([...publicFetches, ...authFetches]);

            if (reviewsResult.status === 'fulfilled') set_reviews(reviewsResult.value);
            if (statsResult.status === 'fulfilled') setClubStats(statsResult.value?.[0]);
            if (topTagsResult.status === 'fulfilled') setTopTags((topTagsResult.value || []).map(r => r.tag));
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

    const handleSave = async () => {
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
            const saved = await apiFetch(`/clubs/${id}/page`, {
                method: 'PUT',
                body: { modules: finalDraft },
            });
            setPageData(saved);
            setDraft(saved?.modules ?? finalDraft);
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
        setIsEditing(false);
    };

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
                        />
                    );
                })}

            {isApproved && isEditing && (
                <div className="expanded-edit-actions">
                    <button onClick={handleCancel} disabled={isSaving}>Cancel</button>
                    <button className="save-btn" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? '`  Saving...' : 'Save'}
                    </button>
                </div>
            )}

            {user && (
                <button
                    className={`membership-btn ${isMember ? 'leave' : 'join'}`}
                    onClick={handleMembership}
                    disabled={memberLoading}
                >
                    {memberLoading ? '...' : isMember ? 'Leave Club' : 'Join Club'}
                </button>
            )}

            <div className="content-col-divider">
                <div className="divider"></div>
            </div>

            <div className="view-reviews">
                <ReviewList reviews={reviews} club_stats={club_stats} club={club} />
            </div>

            <div style={{ marginBottom: "30px" }}>
                <h3>Have you been in this club?</h3>
                <div>{isClicked
                    ? <img src={logImage} className="log-btn" alt="Clicked state" />
                    : <button className="review-btn" onClick={handleClick}>Share your experience</button>
                }</div>
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
