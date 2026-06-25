import React, { useState, useEffect, useRef, useCallback } from 'react';
import "./ReviewList.css";
import { apiFetch } from "../lib/api";
import { useClubData } from "../context/useClubData";

/* ── Helpers ── */

function formatRelativeDate(dateStr) {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    if (days < 14) return '1 week';
    const d = new Date(dateStr);
    return `'${String(d.getFullYear()).slice(-2)} ${d.getMonth() + 1} ${d.getDate()}`;
}

function formatLikeCount(n) {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}m`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n ?? 0);
}

function getImages(review) {
    if (Array.isArray(review.review_images) && review.review_images.length > 0) return review.review_images;
    if (review.review_image) return [review.review_image];
    return [];
}

/* ── Image with fallback ── */

function Img({ src, alt, className }) {
    const [failed, setFailed] = useState(false);
    if (failed || !src) return <div className={`comment-img-placeholder ${className || ''}`}>No image</div>;
    return <img src={src} alt={alt || ''} className={className} onError={() => setFailed(true)} />;
}

/* ── Image carousel (natural aspect ratio) ── */

function ImageCarousel({ images }) {
    const [index, setIndex] = useState(0);
    const total = images.length;
    if (!total) return null;

    const goPrev = (e) => { e.stopPropagation(); setIndex((i) => (i - 1 + total) % total); };
    const goNext = (e) => { e.stopPropagation(); setIndex((i) => (i + 1) % total); };

    return (
        <div className="comment-carousel">
            <Img src={images[index]} alt="comment image" className="comment-carousel__img" />
            {total > 1 && (
                <>
                    <button className="comment-carousel__nav comment-carousel__nav--left" onClick={goPrev} aria-label="Previous">‹</button>
                    <button className="comment-carousel__nav comment-carousel__nav--right" onClick={goNext} aria-label="Next">›</button>
                    <div className="comment-carousel__dots">
                        {images.map((_, i) => (
                            <span key={i} className={`comment-carousel__dot ${i === index ? 'is-active' : ''}`} />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

/* ── Like button ── */

function LikeButton({ count, isLiked, onToggle }) {
    return (
        <button
            className={`comment-like-btn ${isLiked ? 'comment-like-btn--active' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            aria-label={isLiked ? 'Unlike' : 'Like'}
        >
            ♥ {formatLikeCount(count)}
        </button>
    );
}

/* ── Comment card ── */

function CommentCard({ review, userVote, onVote, onToggleHide, editing }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [needsExpand, setNeedsExpand] = useState(false);
    const cardRef = useRef(null);

    const title = review.review_title?.trim() || '';
    const text = review.review_text?.trim() || '';
    const images = getImages(review);
    const date = review.created_at;

    useEffect(() => {
        if (!cardRef.current) return;
        // Measure after images might have loaded — use a small delay
        const check = () => {
            if (cardRef.current && cardRef.current.scrollHeight > 800) setNeedsExpand(true);
        };
        const t = setTimeout(check, 150);
        return () => clearTimeout(t);
    }, []);

    return (
        <div
            className={`comment-card${review.isHidden && editing ? ' comment-card--hidden' : ''}`}
            ref={cardRef}
            data-expanded={isExpanded || undefined}
        >
            {title && <h4 className="comment-title">{title}</h4>}
            {title && (images.length > 0 || text) && <div className="comment-divider" />}

            {images.length > 0 && (
                <div className="comment-image">
                    <ImageCarousel images={images} />
                </div>
            )}
            {images.length > 0 && text && <div className="comment-divider" />}

            {text && <p className="comment-text">{text}</p>}

            <div className="comment-footer">
                {date && <span className="comment-date">{formatRelativeDate(date)}</span>}
                <LikeButton
                    count={review._liveScore}
                    isLiked={userVote === 1}
                    onToggle={() => onVote(userVote === 1 ? 0 : 1)}
                />
            </div>

            {needsExpand && !isExpanded && (
                <div className="comment-expand-fade" />
            )}
            {needsExpand && (
                <button
                    className="comment-expand-btn"
                    onClick={(e) => { e.stopPropagation(); setIsExpanded(v => !v); }}
                >
                    {isExpanded ? 'Less' : 'More'}
                </button>
            )}

            {editing && (
                <label className="comment-hide-label">
                    <input
                        type="checkbox"
                        checked={!!review.isHidden}
                        onChange={() => onToggleHide(review.id, !review.isHidden)}
                        onClick={(e) => e.stopPropagation()}
                    />
                    Hide comment
                </label>
            )}
        </div>
    );
}

/* ── ReviewList (main export) ── */

export default function ReviewList({ reviews, editing, members, onToggleHide }) {
    const [activeTab, setActiveTab] = useState(0); // 0 = Members, 1 = Others
    const [userVotes, setUserVotes] = useState({});
    const [reviewScores, setReviewScores] = useState({});
    const { userId } = useClubData();

    // Seed live scores and fetch user votes
    useEffect(() => {
        setReviewScores(prev => {
            const next = { ...prev };
            reviews.forEach(r => { if (!(r.id in next)) next[r.id] = r.upvotes ?? 0; });
            return next;
        });

        if (!userId || reviews.length === 0) { setUserVotes({}); return; }

        const ids = reviews.map(r => r.id);
        apiFetch(`/me/votes?reviewIds=${ids.join(',')}`)
            .then(data => {
                const votes = {};
                (data || []).forEach(v => { votes[v.review_id] = v.vote; });
                setUserVotes(votes);
            })
            .catch(err => console.error('Error fetching votes:', err));
    }, [reviews, userId]);

    const handleVote = useCallback(async (id, direction) => {
        const currentVote = userVotes[id] || 0;
        const newVote = currentVote === direction ? 0 : direction;
        const delta = newVote - currentVote;
        const oldScore = reviewScores[id] ?? 0;

        setUserVotes(prev => ({ ...prev, [id]: newVote }));
        setReviewScores(prev => ({ ...prev, [id]: oldScore + delta }));

        try {
            const resp = newVote === 0
                ? await apiFetch(`/me/votes/${id}`, { method: 'DELETE' })
                : await apiFetch('/me/votes', { method: 'POST', body: { review_id: id, vote: newVote } });
            if (resp && typeof resp.upvotes === 'number') {
                setReviewScores(prev => ({ ...prev, [id]: resp.upvotes }));
            }
        } catch (err) {
            console.error('Vote error:', err);
            setUserVotes(prev => ({ ...prev, [id]: currentVote }));
            setReviewScores(prev => ({ ...prev, [id]: oldScore }));
        }
    }, [userVotes, reviewScores]);

    const handleToggleHide = useCallback(async (reviewId, hidden) => {
        if (onToggleHide) onToggleHide(reviewId, hidden);
        try {
            await apiFetch(`/reviews/${reviewId}`, { method: 'PATCH', body: { isHidden: hidden }, auth: true });
        } catch (err) {
            console.error('Hide toggle error:', err);
            if (onToggleHide) onToggleHide(reviewId, !hidden); // revert on failure
        }
    }, [onToggleHide]);

    // Enrich reviews with live scores
    const enriched = reviews.map(r => ({ ...r, _liveScore: reviewScores[r.id] ?? (r.upvotes ?? 0) }));

    // In view mode filter hidden; in edit mode show all so owner can unhide
    const visible = editing ? enriched : enriched.filter(r => !r.isHidden);

    const memberIds = new Set((members || []).map(m => m.user_id));
    const authorizedReviews = visible.filter(r => memberIds.has(r.user_id));
    const unauthorizedReviews = visible.filter(r => !memberIds.has(r.user_id));
    const activeReviews = activeTab === 0 ? authorizedReviews : unauthorizedReviews;

    return (
        <div className="review-item">
            <p className="divider-header">Comments</p>

            <div className="comment-tabs" role="tablist">
                {['Members', 'Others'].map((label, i) => (
                    <button
                        key={label}
                        role="tab"
                        aria-selected={activeTab === i}
                        className={`mr-cat-tab ${activeTab === i ? 'active' : ''}`}
                        onClick={() => setActiveTab(i)}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {activeReviews.length > 0 ? (
                <div className="rl-comments-row">
                    {activeReviews.map(review => (
                        <CommentCard
                            key={review.id}
                            review={review}
                            userVote={userVotes[review.id] || 0}
                            onVote={(val) => handleVote(review.id, val)}
                            onToggleHide={handleToggleHide}
                            editing={editing}
                        />
                    ))}
                </div>
            ) : (
                <p className="comment-empty">No comments yet</p>
            )}
        </div>
    );
}
