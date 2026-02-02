import React, { useState, useEffect, useRef } from 'react';
import "./ReviewList.css"

export const ReviewList = ({review}) => {
    


    return (
        <div className = "ReviewBox">
            <p>testing for da box</p>
            <p>{review.rating}</p>
        </div>
    );
};

