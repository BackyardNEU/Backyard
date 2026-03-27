import React, { useState, useEffect } from 'react';
import "./ReviewList.css"

export default function ReviewList({review}) {
    const [imageAspectRatios, setImageAspectRatios] = useState([]);
    
    const stat_categories = [
        {label: "Time commitment", value: review.club_hours, color: 'rgba(82, 50, 6, 1)', end: 12 },
        {label: "Skill Growth Index", value: review.club_growth_index, color: 'rgb(47, 115, 164)', end: 10 },
        {label: "Community", value: review.club_community, color: 'rgba(255, 128, 0, 1)', end: 10 },
        {label: "Leadership", value: review.club_leadership, color: 'rgba(198, 165, 1, 0.85)', end: 10 },
        {label: "Fun Index", value: review.club_fun, color: 'rgba(124, 124, 124, 0.85)', end: 10},
    ];
    
    // Load images and calculate aspect ratios
    useEffect(() => {
        if (!review.review_images || review.review_images.length === 0) return;
        
        const loadImageAspectRatios = async () => {
            const ratios = await Promise.all(
                review.review_images.map(src => {
                    return new Promise((resolve) => {
                        const img = new Image();
                        img.onload = () => {
                            const ratio = img.width / img.height;
                            resolve(ratio);
                        };
                        img.onerror = () => resolve(1); // Default to square on error
                        img.src = src;
                    });
                })
            );
            setImageAspectRatios(ratios);
        };
        
        loadImageAspectRatios();
    }, [review.review_images]);
    
    // Function to determine grid class based on aspect ratio
    const getGridClassByAspectRatio = (aspectRatio, index, total) => {
        // If aspect ratios haven't loaded yet, return default
        if (!aspectRatio) return 'grid-item-normal';
        
        // Single image - make it large
        if (total === 1) return 'grid-item-large';
        
        // Landscape/Wide images (width > height significantly)
        if (aspectRatio > 1.5) return 'grid-item-wide';
        
        // Portrait/Tall images (height > width significantly)
        if (aspectRatio < 0.7) return 'grid-item-tall';
        
        // Square-ish images
        if (aspectRatio >= 0.9 && aspectRatio <= 1.1) {
            // Make some square images large for variety
            // Use index to create a pattern
            if (index % 5 === 0 && total > 3) return 'grid-item-large';
            return 'grid-item-normal';
        }
        
        // Slightly wide
        if (aspectRatio > 1.1 && aspectRatio <= 1.5) return 'grid-item-wide';
        
        // Slightly tall
        if (aspectRatio >= 0.7 && aspectRatio < 0.9) return 'grid-item-tall';
        
        // Default
        return 'grid-item-normal';
    };
    
    return (
        <div className="review-item">
            {stat_categories.map((cat) => {
                const bar_percentage = ((cat.value)/(cat.end)) * 100;
                return (
                    <div className="range-row" key={cat.label}>
                        <div className="vert-flex">
                            <p className="number" style={{color: cat.color}}>
                                {cat.value} <span className="number-small">/{cat.end}</span>
                            </p>
                            <span className="range-label">{cat.label}</span>
                        </div>
                        <div className="range-bar-container"> 
                            <div 
                                className="range-bar-fill" 
                                style={{width: `${bar_percentage}%`, backgroundColor: cat.color}} 
                            /> 
                        </div>
                    </div>
                );
            })}
            
            <p className="divider-header">Comments</p>
            
            {/* Mosaic Image Gallery */}
            {review.review_images && review.review_images.length > 0 && (
                <div className="mosaic-gallery">
                    {review.review_images.map((image, index) => (
                        <div 
                            className={`mosaic-item ${getGridClassByAspectRatio(
                                imageAspectRatios[index], 
                                index, 
                                review.review_images.length
                            )}`}
                            key={index}
                        >
                            <img src={image} alt={`Review image ${index + 1}`} />
                        </div>
                    ))}
                </div>
            )}
            
            <p className="comment-title">{review.review_title}</p>
            <p>{review.review_text}</p>
        </div>
    );
}