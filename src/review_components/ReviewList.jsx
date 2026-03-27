import React, { useState, useEffect, useRef } from 'react';
import "./ReviewList.css";
import StatsCard from "./StatsCard.jsx";

export default function ReviewList({ reviews, club_stats, club }) {
    const [scrollIndex, setScrollIndex] = useState(0);
    const [expandedImage, setExpandedImage] = useState(null);
    const [expandedReview, setExpandedReview] = useState(null);
    const galleryRef = useRef(null);

    const scrollLeft = () => setScrollIndex((prev) => Math.max(prev - 1, 0));
    const scrollRight = () => setScrollIndex((prev) => Math.min(prev + 1, reviews.length - 1));

    // Close lightbox on escape
    useEffect(() => {
        const handler = (e) => {
            if (e.key === "Escape") {
                setExpandedImage(null);
                setExpandedReview(null);
            }
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, []);

    // Scroll gallery into position
    useEffect(() => {
        if (!galleryRef.current) return;
        const card = galleryRef.current.children[scrollIndex];
        if (card) {
            card.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
        }
    }, [scrollIndex]);

    const handleImageClick = (imageSrc, review) => {
        setExpandedImage(imageSrc);
        setExpandedReview(review);
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
                <div className="gallery-wrapper">
                    <button
                        className="gallery-arrow gallery-arrow-left"
                        onClick={scrollLeft}
                        disabled={scrollIndex === 0}
                    >
                        &#8249;
                    </button>

                    <div className="gallery-track" ref={galleryRef}>
                        {reviews.map((review, ri) => (
                            <div key={review.id} className="gallery-card">
                                {/* Image side */}
                                <div className="gallery-artwork">
                                    {review.review_images && review.review_images.length > 0 ? (
                                        <img
                                            src={review.review_images[0]}
                                            alt={review.review_title}
                                            className="artwork-img"
                                            onClick={() => handleImageClick(review.review_images[0], review)}
                                        />
                                    ) : (
                                        <div className="artwork-placeholder">
                                            <span>No image</span>
                                        </div>
                                    )}

                                    {/* Thumbnail strip for multiple images */}
                                    {review.review_images && review.review_images.length > 1 && (
                                        <div className="artwork-thumbnails">
                                            {review.review_images.map((img, ii) => (
                                                <img
                                                    key={ii}
                                                    src={img}
                                                    alt={`Thumbnail ${ii + 1}`}
                                                    className="artwork-thumb"
                                                    onClick={() => handleImageClick(img, review)}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Museum label side */}
                                <div className="museum-label">
                                    <h3 className="museum-label-title">{review.review_title}</h3>
                                    <div className="museum-label-line"></div>
                                    <p className="museum-label-text">{review.review_text}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        className="gallery-arrow gallery-arrow-right"
                        onClick={scrollRight}
                        disabled={scrollIndex >= reviews.length - 1}
                    >
                        &#8250;
                    </button>
                </div>
            ) : (
                <p className="empty-text">No reviews yet — be the first!</p>
            )}

            {/* ---- Lightbox ---- */}
            {expandedImage && expandedReview && (
                <div className="lightbox-overlay" onClick={() => { setExpandedImage(null); setExpandedReview(null); }}>
                    <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
                        <button className="lightbox-close" onClick={() => { setExpandedImage(null); setExpandedReview(null); }}>
                            &times;
                        </button>
                        <div className="lightbox-image-container">
                            <img src={expandedImage} alt={expandedReview.review_title} className="lightbox-img" />

                            {/* Image nav if multiple */}
                            {expandedReview.review_images && expandedReview.review_images.length > 1 && (
                                <div className="lightbox-thumbs">
                                    {expandedReview.review_images.map((img, i) => (
                                        <img
                                            key={i}
                                            src={img}
                                            alt={`Thumb ${i + 1}`}
                                            className={`lightbox-thumb ${img === expandedImage ? 'active' : ''}`}
                                            onClick={() => setExpandedImage(img)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="lightbox-label">
                            <h3 className="museum-label-title">{expandedReview.review_title}</h3>
                            <div className="museum-label-line"></div>
                            <p className="museum-label-text">{expandedReview.review_text}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ---- Contact ---- */}
            <div className="divider"></div>
            <p className="divider-header">Contact</p>
            <p>{club.contact_email || "No contact info available."}</p>
            <div className="divider"></div>
        </div>
    );
}