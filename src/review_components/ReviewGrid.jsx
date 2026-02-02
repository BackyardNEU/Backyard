import React, { useState, useEffect, useRef } from 'react';
import "./ReviewGrid.css"

export const ReviewGrid = ({review}) => {
    


    return (
        <div className = "ReviewBox">
            <p>testing for da box</p>
            <p>{review.rating}</p>
        </div>
    );
};

