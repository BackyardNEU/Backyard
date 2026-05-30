import React, {useState, useEffect, useCallback} from "react";
import { motion } from "framer-motion";
import ReviewPage from "../review_components/ReviewPage";
import "./ExpandedTile.css";
import ReviewList from "../review_components/ReviewList";
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import logImage from '/src/assets/logImage.png';
import BasicInfoModule from '../club_page_components/BasicInfoModule';


function ExpandedTile({club, onClose, onMembershipChange}){
    const [animationDone, setAnimationDone] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [reviews, set_reviews] = useState([]);
    const [isClicked, setIsClicked] = useState(false);
    const [club_stats, setClubStats] = useState(null);
    const [user, setUser] = useState(null);
    const [isMember, setIsMember] = useState(false);
    const [memberLoading, setMemberLoading] = useState(false);

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
        setTimeout(() => {
            setIsClicked(false);
        }, 350);
    };

    useEffect(() => {
        async function fetch_reviews() {
            if (!animationDone) return;
            try {
                const data = await apiFetch(`/clubs/${id}/reviews`, { auth: false });
                set_reviews(data);
            } catch (err) {
                console.error('Error fetching reviews:', err);
            }
        }
        fetch_reviews();
    }, [id, animationDone]);

    useEffect(() => {
        async function fetch_stats(clubId) {
            if (!animationDone) return;
            try {
                const data = await apiFetch(`/clubs/${clubId}/stats`, { auth: false });
                setClubStats(data[0]);
            } catch (err) {
                console.error("Error fetching stats:", err);
            }
        }
        fetch_stats(id);
    }, [id, animationDone]);

    useEffect(() => {
        async function checkMembership() {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) { setUser(null); return; }
            setUser(authUser);
            try {
                const { member_list } = await apiFetch('/me/membership');
                setIsMember((member_list || []).includes(club.id));
            } catch (err) {
                console.error('Error fetching membership:', err);
            }
        }
        checkMembership();
    }, [club.id, animationDone]);

    async function handleMembership() {
        if (!user || memberLoading) return;
        setMemberLoading(true);
        try {
            const { member_list } = await apiFetch('/me/membership');
            let list = member_list || [];
            if (isMember) {
                list = list.filter((cid) => cid !== club.id);
            } else {
                list = [...list, club.id];
            }
            await apiFetch('/me/membership', { method: 'PUT', body: { member_list: list } });
            const wasJoined = isMember;
            setIsMember(!isMember);
            if (onMembershipChange) onMembershipChange(club.id, !wasJoined);
        } catch (err) {
            console.error('Error updating membership:', err);
        }
        setMemberLoading(false);
    }

    return (
        <motion.div
            layoutId={`club-${club.id}`}
            className="expanded-card"
            style={{ pointerEvents: isClosing ? "none" : "auto" }}
            transition={{
                type: "spring",
                stiffness: 400,
                damping: 30
            }}
            onAnimationComplete={() => setAnimationDone(true)}
        >
            <button className="close-btn" onClick={handleClose}>x</button>

            <BasicInfoModule club={club} />

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
