import React, { useState, useEffect, useRef } from 'react';
import "./ReviewList.css"

export default function ReviewList({review}) {
    //add javascript stuff here, not much is needed but we definitely need something if we want to get er done

    const stat_categories = [{label: "Time commitment", value: review.club_hours, color: 'rgba(82, 50, 6, 1)', end: 12 },
                             {label: "Skill Growth Index", value: review.club_growth_index, color: 'rgb(47, 115, 164)', end: 10 },
                             {label: "Community", value: review.club_community, color: 'rgba(255, 128, 0, 1)', end: 10 },
                             {label: "Leadership", value: review.club_leadership, color: 'rgba(198, 165, 1, 0.85)', end: 10 },
                             {label: "Fun Index", value: review.club_fun, color: 'rgba(124, 124, 124, 0.85)', end: 10},
                             ]
    
    return (
        <div className = "review-item">
        {stat_categories.map((cat) => {
            const bar_percentage = ((cat.value)/(cat.end)) *100;
            return (
                <div className = "range-row" key = {cat.label}>
                <div className= "vert-flex">
                <p className="number" style = {{color: `${cat.color}`}}>{cat.value} <span className="number-small">/{cat.end}</span></p>
                <span className = "range-label">{cat.label}</span>
                </div>
                
                <div className = "range-bar-container"> 
                        <div 
                            className = "range-bar-fill" 
                            style = {{width: `${bar_percentage}%`, backgroundColor: `${cat.color}` }} 
                        /> 
                
                </div>
                </div>
            );
        })}
        <p className = "divider-header">Comments</p>
        <img src={review.review_image} />
        <p className = "comment-title">{review.review_title}</p>
      <p>{review.review_text}</p>
        </div>
    );
        }
    //             <div className = "content">

    //             </div>
    //         </div>
    //         <div className = "review-card">
    //             <p>{review.review_title}</p>
    //             <p>{review.review_text}</p>
                
    //         </div>
    //     );
    // };

//review.rating is going to be our current rating system, but from there on we can expand what ratings it shows (like difficulty, workload, etc)