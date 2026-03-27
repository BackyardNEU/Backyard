import React, { useState, useEffect } from 'react';
import "./ReviewList.css";
import StatsCard from "./StatsCard.jsx";

export default function ReviewList({ reviews, club_stats, club }) {
    const [imageAspectRatios, setImageAspectRatios] = useState({});

    useEffect(() => {
        const allImages = reviews.flatMap((r, ri) =>
            (r.review_images || []).map((src, ii) => ({ key: `${ri}-${ii}`, src }))
        );
        if (allImages.length === 0) return;

        const loadRatios = async () => {
            const entries = await Promise.all(
                allImages.map(({ key, src }) =>
                    new Promise((resolve) => {
                        const img = new Image();
                        img.onload = () => resolve([key, img.width / img.height]);
                        img.onerror = () => resolve([key, 1]);
                        img.src = src;
                    })
                )
            );
            setImageAspectRatios(Object.fromEntries(entries));
        };
        loadRatios();
    }, [reviews]);

    const getGridClass = (aspectRatio, index, total) => {
        if (!aspectRatio) return 'grid-item-normal';
        if (total === 1) return 'grid-item-large';
        if (aspectRatio > 1.5) return 'grid-item-wide';
        if (aspectRatio < 0.7) return 'grid-item-tall';
        if (aspectRatio >= 0.9 && aspectRatio <= 1.1) {
            if (index % 5 === 0 && total > 3) return 'grid-item-large';
            return 'grid-item-normal';
        }
        if (aspectRatio > 1.1 && aspectRatio <= 1.5) return 'grid-item-wide';
        if (aspectRatio >= 0.7 && aspectRatio < 0.9) return 'grid-item-tall';
        return 'grid-item-normal';
    };

    return (
        <div className="review-item">
            {/* ---- Stats ---- */}
            <p className="divider-header">Stats</p>
            <StatsCard stats_array={club_stats} />

            {/* ---- Comments ---- */}
             <div className="divider"></div>
            <p className="divider-header">Comments</p>
            {reviews.length > 0 ? (
                reviews.map((review, ri) => (
                    <div key={review.id} className="single-review">
                        <p className="comment-title">{review.review_title}</p>
                        <p>{review.review_text}</p>

                        {review.review_images && review.review_images.length > 0 && (
                            <div className="mosaic-gallery">
                                {review.review_images.map((image, ii) => (
                                    <div
                                        className={`mosaic-item ${getGridClass(
                                            imageAspectRatios[`${ri}-${ii}`],
                                            ii,
                                            review.review_images.length
                                        )}`}
                                        key={ii}
                                    >
                                        <img src={image} alt={`Review image ${ii + 1}`} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))
            ) : (
                <p className="empty-text">No reviews yet — be the first!</p>
            )}

            {/* ---- Contact ---- */}
            <div className="divider"></div>
            <p className="divider-header">Contact</p>
            <p>{club.contact_email || "No contact info available."}</p>
            <div className="divider"></div>
        </div>
    );
}