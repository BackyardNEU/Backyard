import React, { useState, useEffect, useCallback } from 'react';
import "./ReviewList.css";
import StatsCard from "./StatsCard.jsx";
import { UpvoteWidget } from "./UpvoteWidget";
import { supabase } from "../lib/supabase";
import { useClubData } from "../context/useClubData";

/**
 * Determine the comment type based on available data.
 */
function getCommentType(review) {
    const hasImages = review.review_images && review.review_images.length > 0;
    const hasText = review.review_text && review.review_text.trim().length > 0;
    if (hasImages && hasText) return 'normal';
    if (hasImages && !hasText) return 'image_only';
    return 'text_only';
}

/** Format date to "'YY M D" */
function formatDate(dateStr) {
    try {
        const d = new Date(dateStr);
        return `'${String(d.getFullYear()).slice(-2)} ${d.getMonth() + 1} ${d.getDate()}`;
    } catch { return ''; }
}

/* ============================================================
   Image with fallback
   ============================================================ */
function Img({ src, alt, className, onClick }) {
    const [failed, setFailed] = useState(false);
    if (failed || !src) {
        return <div className={`rl-img-placeholder ${className || ''}`}>No image</div>;
    }
    return (
        <img
            src={src}
            alt={alt || ''}
            className={className}
            onClick={onClick}
            onError={() => setFailed(true)}
        />
    );
}

function getImages(comment) {
    if (Array.isArray(comment.review_images) && comment.review_images.length > 0) {
        return comment.review_images;
    }
    if (comment.review_image) {
        return [comment.review_image];
    }
    return [];
}

function ImageCarousel({ images, alt, className }) {
    const [index, setIndex] = useState(0);
    const total = images.length;
    if (!total) {
        return <div className={`rl-img-placeholder ${className || ''}`}>No image</div>;
    }

    const goPrev = (e) => {
        e.stopPropagation();
        setIndex((prev) => (prev - 1 + total) % total);
    };
    const goNext = (e) => {
        e.stopPropagation();
        setIndex((prev) => (prev + 1) % total);
    };

    return (
        <div className={`rl-carousel ${className || ''}`}>
            <Img src={images[index]} alt={alt} className="rl-carousel__img" />
            {total > 1 && (
                <>
                    <button className="rl-carousel__nav rl-carousel__nav--left" onClick={goPrev} aria-label="Previous photo">‹</button>
                    <button className="rl-carousel__nav rl-carousel__nav--right" onClick={goNext} aria-label="Next photo">›</button>
                    <div className="rl-carousel__dots">
                        {images.map((_, i) => (
                            <span key={i} className={`rl-carousel__dot ${i === index ? 'is-active' : ''}`} />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

/* ============================================================
   Comment Card  (rendered in the grid)
   ============================================================ */
function CommentCard({ comment, type, userVote, onVote, onClick }) {
    const images = getImages(comment);
    if (type === 'normal') {
        return (
            <div className="rl-card rl-card--normal" onClick={onClick}>
                <div className="rl-card__image-wrap">
                    <ImageCarousel images={images} alt={comment.review_title} className="rl-card__image" />
                    {comment.created_at && <span className="rl-card__date">{formatDate(comment.created_at)}</span>}
                </div>
                <div className="rl-card__body">
                    <h4 className="rl-card__title">{comment.review_title}</h4>
                    <p className="rl-card__text">{comment.review_text}</p>
                    <div className="rl-card__footer">
                        <UpvoteWidget score={comment._liveScore} userVote={userVote} onVote={onVote} variant="stacked" />
                    </div>
                </div>
            </div>
        );
    }

    if (type === 'text_only') {
        return (
            <div className="rl-card rl-card--text" onClick={onClick}>
                <div className="rl-card__text-header">
                    <h4 className="rl-card__title">{comment.review_title}</h4>
                    {comment.created_at && <span className="rl-card__date-inline">{formatDate(comment.created_at)}</span>}
                </div>
                <p className="rl-card__text rl-card__text--long">{comment.review_text}</p>
                <div className="rl-card__footer">
                    <UpvoteWidget score={comment._liveScore} userVote={userVote} onVote={onVote} variant="stacked" />
                </div>
            </div>
        );
    }

    // image_only
    return (
        <div className="rl-card rl-card--imgonly" onClick={onClick}>
            <div className="rl-card__image-wrap">
                <ImageCarousel images={images} alt="Review image" className="rl-card__image" />
                {comment.created_at && <span className="rl-card__date">{formatDate(comment.created_at)}</span>}
            </div>
            <div className="rl-card__vote rl-card__vote--end">
                <UpvoteWidget score={comment._liveScore} userVote={userVote} onVote={onVote} variant="pill" />
            </div>
        </div>
    );
}

/* ============================================================
   Fullscreen Lightbox
   ============================================================ */
function Lightbox({ comment, type, userVote, onVote, onClose }) {
    const images = getImages(comment);
    // Close on Escape
    useEffect(() => {
        const h = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', h);
        return () => document.removeEventListener('keydown', h);
    }, [onClose]);

    return (
        <div className="rl-lightbox" onClick={onClose}>
            <div className="rl-lightbox__inner" onClick={(e) => e.stopPropagation()}>
                <button className="rl-lightbox__close" onClick={onClose}>&times;</button>

                {type === 'normal' && (
                    <>
                        <div className="rl-lightbox__img-col">
                            <ImageCarousel images={images} alt={comment.review_title} className="rl-lightbox__img" />
                        </div>
                        <div className="rl-lightbox__label">
                            <h3 className="rl-lightbox__title">{comment.review_title}</h3>
                            {comment.created_at && <span className="rl-lightbox__date">{formatDate(comment.created_at)}</span>}
                            <div className="rl-lightbox__line"></div>
                            <p className="rl-lightbox__text">{comment.review_text}</p>
                            <div className="rl-lightbox__vote">
                                <UpvoteWidget score={comment._liveScore} userVote={userVote} onVote={onVote} variant="pill" theme="dark" />
                            </div>
                        </div>
                    </>
                )}

                {type === 'text_only' && (
                    <div className="rl-lightbox__text-full">
                        <h3 className="rl-lightbox__title rl-lightbox__title--big">{comment.review_title}</h3>
                        {comment.created_at && <span className="rl-lightbox__date">{formatDate(comment.created_at)}</span>}
                        <div className="rl-lightbox__line"></div>
                        <p className="rl-lightbox__text">{comment.review_text}</p>
                        <div className="rl-lightbox__vote">
                            <UpvoteWidget score={comment._liveScore} userVote={userVote} onVote={onVote} variant="pill" theme="dark" />
                        </div>
                    </div>
                )}

                {type === 'image_only' && (
                    <div className="rl-lightbox__img-col rl-lightbox__img-col--solo">
                        <ImageCarousel images={images} alt="Review image" className="rl-lightbox__img" />
                        <div className="rl-lightbox__vote rl-lightbox__vote--overlay">
                            <UpvoteWidget score={comment._liveScore} userVote={userVote} onVote={onVote} variant="pill" theme="dark" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ============================================================
   ReviewList  (main export)
   ============================================================ */
export default function ReviewList({ reviews, club_stats, club }) {
    const [selectedId, setSelectedId] = useState(null);
    const [userVotes, setUserVotes] = useState({});
    const [reviewScores, setReviewScores] = useState({});
    const { userId } = useClubData();

    useEffect(() => {
        setReviewScores(prev => {
            const next = { ...prev };
            reviews.forEach(r => {
                if (!(r.id in next)) next[r.id] = r.upvotes ?? 0;
            });
            return next;
        });

        if (!userId || reviews.length === 0) {
            setUserVotes({});
            return;
        }

        const reviewIds = reviews.map(r => r.id);
        supabase
            .from('user_votes')
            .select('review_id, vote')
            .eq('user_id', userId)
            .in('review_id', reviewIds)
            .then(({ data, error }) => {
                if (error) { console.error('Error fetching user votes:', error); return; }
                const votes = {};
                data.forEach(v => { votes[v.review_id] = v.vote; });
                setUserVotes(votes);
            });
    }, [reviews, userId]);

    const handleVote = useCallback(async (id, direction) => {
        const currentVote = userVotes[id] || 0;
        const newVote = currentVote === direction ? 0 : direction;
        const voteDelta = newVote - currentVote;
        const oldScore = reviewScores[id] ?? 0;
        const newScore = oldScore + voteDelta;

        // optimistic UI
        setUserVotes((prev) => ({ ...prev, [id]: newVote }));
        setReviewScores((prev) => ({ ...prev, [id]: newScore }));

        try {
            const { error: scoreError } = await supabase
                .from('reviews')
                .update({ upvotes: newScore })
                .eq('id', id);
            if (scoreError) throw scoreError;

            if (newVote === 0) {
                const { error: voteError } = await supabase
                    .from('user_votes')
                    .delete()
                    .eq('user_id', userId)
                    .eq('review_id', id);
                if (voteError) throw voteError;
            } else {
                const { error: voteError } = await supabase
                    .from('user_votes')
                    .upsert({ user_id: userId, review_id: id, vote: newVote });
                if (voteError) throw voteError;
            }
        } catch (err) {
            console.error('Vote error:', err);
            setUserVotes((prev) => ({ ...prev, [id]: currentVote }));
            setReviewScores((prev) => ({ ...prev, [id]: oldScore }));
        }
    }, [userVotes, reviewScores, userId]);

    // Attach live score to each review for rendering
    const enriched = reviews.map((r) => ({ ...r, _liveScore: reviewScores[r.id] ?? (r.upvotes ?? 0) }));
    const selectedReview = enriched.find((r) => r.id === selectedId);
    const selectedType = selectedReview ? getCommentType(selectedReview) : null;

    return (
        <div className="review-item">
            <p className="divider-header">Stats</p>
            <StatsCard stats_array={club_stats} />

            <div className="divider"></div>
            <p className="divider-header">Comments</p>

            {enriched.length > 0 ? (
                <div className="rl-grid">
                    {enriched.map((review) => {
                        const type = getCommentType(review);
                        return (
                            <CommentCard
                                key={review.id}
                                comment={review}
                                type={type}
                                userVote={userVotes[review.id] || 0}
                                onVote={(val) => handleVote(review.id, val)}
                                onClick={() => setSelectedId(review.id)}
                            />
                        );
                    })}
                </div>
            ) : (
                <p className="empty-text">No reviews yet — be the first!</p>
            )}

            {selectedReview && (
                <Lightbox
                    comment={selectedReview}
                    type={selectedType}
                    userVote={userVotes[selectedReview.id] || 0}
                    onVote={(val) => handleVote(selectedReview.id, val)}
                    onClose={() => setSelectedId(null)}
                />
            )}

            <div className="divider"></div>
            <p className="divider-header">Contact</p>
            <p>{club.contact_email || "No contact info available."}</p>
            <div className="divider"></div>
        </div>
    );
}