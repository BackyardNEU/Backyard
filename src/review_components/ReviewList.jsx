export default function ReviewList({review}) {
    const stat_categories = [
        {label: "Time commitment", value: review.club_hours, color: 'rgba(82, 50, 6, 1)', end: 12 },
        {label: "Skill Growth Index", value: review.club_growth_index, color: 'rgb(47, 115, 164)', end: 10 },
        {label: "Community", value: review.club_community, color: 'rgba(255, 128, 0, 1)', end: 10 },
        {label: "Leadership", value: review.club_leadership, color: 'rgba(198, 165, 1, 0.85)', end: 10 },
        {label: "Fun Index", value: review.club_fun, color: 'rgba(124, 124, 124, 0.85)', end: 10},
    ];
    
    // Function to determine grid item class based on index
    const getGridClass = (index, total) => {
        const patterns = [
            'grid-item-large',      // 2x2
            'grid-item-wide',       // 2x1
            'grid-item-tall',       // 1x2
            'grid-item-normal',     // 1x1
        ];
        
        // Create a pattern that varies based on index
        if (total === 1) return 'grid-item-large';
        if (total === 2) return index === 0 ? 'grid-item-wide' : 'grid-item-normal';
        
        // For 3+ images, use a repeating pattern
        const patternIndex = index % 4;
        return patterns[patternIndex];
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
                            className={`mosaic-item ${getGridClass(index, review.review_images.length)}`}
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