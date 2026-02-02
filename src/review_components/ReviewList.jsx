import React, { useState, useEffect, useRef } from 'react';
import "./ReviewList.css"

export const ReviewList = ({review}) => {
    //add javascript stuff here, not much is needed but we definitely need something if we want to get er done


    return (
        <div className = "review-card">
            <p>{review.review_text}</p>
            <p>{review.rating}</p>
        </div>
    );
};

//review.rating is going to be our current rating system, but from there on we can expand what ratings it shows (like difficulty, workload, etc)