import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import "./ReviewList.css";
import { apiFetch } from "../lib/api";
import { useClubData } from "../context/useClubData";
import borderImg from '/src/assets/border-green.svg';
import borderHorizontalImg from '/src/assets/border-horizontal-green.svg';
import borderHorizontalGrayImg from '/src/assets/border-horizontal-gray.svg';

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

function Img({ src, alt, className, onLoad }) {
    const [failed, setFailed] = useState(false);
    if (failed || !src) return <div className={`comment-img-placeholder ${className || ''}`}>No image</div>;
    return (
        <img
            src={src}
            alt={alt || ''}
            className={className}
            onError={() => setFailed(true)}
            onLoad={onLoad}
        />
    );
}

/* ── Image carousel ── */

function ImageCarousel({ images, onOrientationChange }) {
    const [index, setIndex] = useState(0);
    const total = images.length;
    if (!total) return null;

    const goPrev = (e) => { e.stopPropagation(); setIndex((i) => (i - 1 + total) % total); };
    const goNext = (e) => { e.stopPropagation(); setIndex((i) => (i + 1) % total); };

    const handleLoad = (e) => {
        const { naturalWidth: nw, naturalHeight: nh } = e.target;
        if (nw && nh && onOrientationChange) {
            const ratio = nw / nh;
            onOrientationChange(ratio > 1.2 ? 'landscape' : ratio < 0.85 ? 'portrait' : 'square');
        }
    };

    return (
        <div className="comment-carousel">
            <Img
                src={images[index]}
                alt="comment image"
                className="comment-carousel__img"
                onLoad={handleLoad}
            />
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

/* ── Like button — stacked heart over count ── */

function LikeButton({ count, isLiked, onToggle }) {
    return (
        <div
            className={`comment-likes${isLiked ? ' comment-likes--active' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggle(isLiked); }}
            role="button"
            tabIndex={0}
            aria-label={isLiked ? 'Unlike' : 'Like'}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        >
            <span className="comment-like-btn">♥</span>
            <span className="comment-like-count">{formatLikeCount(count)}</span>
        </div>
    );
}

/* ── Comment card ── */

function CommentCard({ review, userVote, onVote, onToggleHide, editing }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [needsExpand, setNeedsExpand] = useState(false);
    const [imageOrientation, setImageOrientation] = useState('');
    const bodyRef = useRef(null);

    const title = review.review_title?.trim() || '';
    const text = review.review_text?.trim() || '';
    const images = getImages(review);
    const date = review.created_at;

    // Measure body height after render to decide if More button is needed
    useEffect(() => {
        const check = () => {
            if (bodyRef.current && bodyRef.current.scrollHeight > 500) setNeedsExpand(true);
        };
        const t = setTimeout(check, 150);
        return () => clearTimeout(t);
    }, []);

    return (
        <div
            className={`comment-card${review._pendingHidden && editing ? ' comment-card--hidden' : ''}`}
            data-expanded={isExpanded || undefined}
        >
            <img src={borderImg} alt="" className="comment-border comment-border-left" />
            <img src={borderImg} alt="" className="comment-border comment-border-right" />
            <div
                className="comment-border-h-wrap comment-border-top-wrap"
                style={{ backgroundImage: `url(${borderHorizontalImg})` }}
                aria-hidden="true"
            />
            <div
                className="comment-border-h-wrap comment-border-bottom-wrap"
                style={{ backgroundImage: `url(${borderHorizontalImg})` }}
                aria-hidden="true"
            />

            {/* Body shrinks/expands; footer stays visible */}
            <div className="comment-card__body" ref={bodyRef}>
                {title && <h4 className="comment-title">{title}</h4>}
                {title && (images.length > 0 || text) && (
                    <div className="comment-divider" style={{ backgroundImage: `url(${borderHorizontalGrayImg})` }} />
                )}

                {images.length > 0 && (
                    <div className={`comment-image${imageOrientation ? ` ${imageOrientation}` : ''}`}>
                        <ImageCarousel images={images} onOrientationChange={setImageOrientation} />
                    </div>
                )}
                {images.length > 0 && text && (
                    <div className="comment-divider" style={{ backgroundImage: `url(${borderHorizontalGrayImg})` }} />
                )}

                {text && <p className="comment-text">{text}</p>}

                {needsExpand && !isExpanded && <div className="comment-expand-fade" />}
                {needsExpand && (
                    <button
                        className="comment-expand-btn"
                        onClick={(e) => { e.stopPropagation(); setIsExpanded(v => !v); }}
                    >
                        {isExpanded ? 'Less' : 'More'}
                    </button>
                )}
            </div>

            <div className="comment-footer">
                {date && <span className="comment-date">{formatRelativeDate(date)}</span>}
                <LikeButton
                    count={review._liveScore}
                    isLiked={userVote === 1}
                    onToggle={(currentlyLiked) => onVote(currentlyLiked ? 0 : 1)}
                />
            </div>

            {editing && (
                <label className="comment-hide-label">
                    <input
                        type="checkbox"
                        checked={!!review._pendingHidden}
                        onChange={() => onToggleHide(review.id, !review._pendingHidden)}
                        onClick={(e) => e.stopPropagation()}
                    />
                    Hide comment
                </label>
            )}
        </div>
    );
}

/* ── ReviewList (main export) ── */

export default function ReviewList({ reviews, editing, members, hideDraft = {}, onToggleHide }) {
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

    const handleVote = useCallback(async (id, newVote) => {
        const currentVote = userVotes[id] || 0;
        const oldScore = reviewScores[id] ?? 0;

        setUserVotes(prev => ({ ...prev, [id]: newVote }));
        setReviewScores(prev => ({ ...prev, [id]: oldScore + (newVote - currentVote) }));

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

    const handleToggleHide = useCallback((reviewId, hidden) => {
        onToggleHide?.(reviewId, hidden);
    }, [onToggleHide]);

    const enriched = reviews.map(r => ({
        ...r,
        _liveScore: reviewScores[r.id] ?? (r.upvotes ?? 0),
        _pendingHidden: r.id in hideDraft ? hideDraft[r.id] : (r.is_hidden || r.isHidden || false),
    }));
    const visible = editing ? enriched : enriched.filter(r => !r._pendingHidden);

    const memberIds = useMemo(() => new Set((members || []).map(m => m.user_id)), [members]);
    const authorizedReviews = visible.filter(r => memberIds.has(r.user_id));
    const unauthorizedReviews = visible.filter(r => !memberIds.has(r.user_id));
    const activeReviews = activeTab === 0 ? authorizedReviews : unauthorizedReviews;

    return (
        <div className="review-item">
            <p className="divider-header">Participant Posts</p>

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
