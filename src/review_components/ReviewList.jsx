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

/* ── Wiggly SVG border helpers ── */

const SVG_AMP = 0.2;
const SVG_FREQ = 4;
const SVG_SMOOTH = 35;
const SVG_RADIUS = 10;
const SVG_STROKE = 1;
const SVG_SEED = 1000;

function svgNoise(x) {
    return (
        Math.sin(x * 1.13 + SVG_SEED * 0.7) * 0.55 +
        Math.sin(x * 2.77 + SVG_SEED * 1.1) * 0.30 +
        Math.sin(x * 6.21 + SVG_SEED * 0.3) * 0.15
    );
}

function rrPoints(x, y, w, h, r, s) {
    const pts = [];
    const arc = (cx, cy, a0, a1) => {
        for (let i = 0; i <= s; i++) {
            const a = a0 + (a1 - a0) * (i / s);
            pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
        }
    };
    for (let i = 0; i <= s; i++) pts.push({ x: x + r + (w - r * 2) * (i / s), y });
    arc(x + w - r, y + r, -Math.PI / 2, 0);
    for (let i = 0; i <= s; i++) pts.push({ x: x + w, y: y + r + (h - r * 2) * (i / s) });
    arc(x + w - r, y + h - r, 0, Math.PI / 2);
    for (let i = 0; i <= s; i++) pts.push({ x: x + w - r - (w - r * 2) * (i / s), y: y + h });
    arc(x + r, y + h - r, Math.PI / 2, Math.PI);
    for (let i = 0; i <= s; i++) pts.push({ x, y: y + h - r - (h - r * 2) * (i / s) });
    arc(x + r, y + r, Math.PI, Math.PI * 1.5);
    return pts;
}

function wigglePts(pts) {
    return pts.map((p, i) => {
        const prev = pts[(i - 1 + pts.length) % pts.length];
        const next = pts[(i + 1) % pts.length];
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const len = Math.hypot(dx, dy) || 1;
        const n = svgNoise(i * SVG_FREQ * 0.1) * SVG_AMP;
        return { x: p.x + (-dy / len) * n, y: p.y + (dx / len) * n };
    });
}

function ptsToPath(pts) {
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[i + 2] || p2;
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
    }
    return d + ' Z';
}

function wavyDivPath(y, w) {
    let d = '';
    const steps = SVG_SMOOTH * 4;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = 6 + t * (w - 12);
        const py = y + svgNoise(i * SVG_FREQ * 0.1) * SVG_AMP;
        d += i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
    }
    return d;
}

function drawCardSvg(cardEl, svgEl) {
    const w = cardEl.offsetWidth;
    const h = cardEl.offsetHeight;
    if (!w || !h) return;
    svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);

    const outerPts = wigglePts(rrPoints(SVG_STROKE, SVG_STROKE, w - SVG_STROKE * 2, h - SVG_STROKE * 2, SVG_RADIUS, SVG_SMOOTH));
    let markup = `<path class="border-rect" d="${ptsToPath(outerPts)}"></path>`;

    const cardRect = cardEl.getBoundingClientRect();
    cardEl.querySelectorAll('.comment-divider').forEach(div => {
        const dr = div.getBoundingClientRect();
        const y = dr.top - cardRect.top + dr.height / 2;
        markup += `<path class="divider-line" d="${wavyDivPath(y, w)}"></path>`;
    });

    svgEl.innerHTML = markup;
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
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
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
    const cardRef = useRef(null);
    const bodyRef = useRef(null);
    const svgRef = useRef(null);

    const title = review.review_title?.trim() || '';
    const text = review.review_text?.trim() || '';
    const images = getImages(review);
    const date = review.created_at;

    // Draw/redraw SVG border + dividers, triggered by any layout change
    useEffect(() => {
        const card = cardRef.current;
        const svg = svgRef.current;
        if (!card || !svg) return;
        const draw = () => drawCardSvg(card, svg);
        draw();
        const ro = new ResizeObserver(draw);
        ro.observe(card);
        return () => ro.disconnect();
    }, []);

    // Redraw when expand toggles (card height animates) or image loads
    useEffect(() => {
        if (cardRef.current && svgRef.current) {
            drawCardSvg(cardRef.current, svgRef.current);
        }
    }, [isExpanded, imageOrientation]);

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
            className={`comment-card${review.isHidden && editing ? ' comment-card--hidden' : ''}`}
            ref={cardRef}
            data-expanded={isExpanded || undefined}
        >
            <svg ref={svgRef} className="comment-border-svg" />

            {/* Body shrinks/expands; footer stays visible */}
            <div className="comment-card__body" ref={bodyRef}>
                {title && <h4 className="comment-title">{title}</h4>}
                {title && (images.length > 0 || text) && <div className="comment-divider" />}

                {images.length > 0 && (
                    <div className={`comment-image${imageOrientation ? ` ${imageOrientation}` : ''}`}>
                        <ImageCarousel images={images} onOrientationChange={setImageOrientation} />
                    </div>
                )}
                {images.length > 0 && text && <div className="comment-divider" />}

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
                    onToggle={() => onVote(userVote === 1 ? 0 : 1)}
                />
            </div>

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
            if (onToggleHide) onToggleHide(reviewId, !hidden);
        }
    }, [onToggleHide]);

    const enriched = reviews.map(r => ({ ...r, _liveScore: reviewScores[r.id] ?? (r.upvotes ?? 0) }));
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
