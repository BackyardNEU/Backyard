import React, { useState, useEffect } from 'react';
import { startOfDay, addDays, isWithinInterval, format } from 'date-fns';
import './CalendarList.css';

//events will be the array of club events happening that match a user's favorited clubs. If empty, no events will be displayed and a special message will appear.
export const CalendarList = ({ events }) => {
    const currentDayOfWeek = startOfDay(new Date());
    
    const days = [
        { name: "monday", label: "Monday"},
        { name: "tuesday", label: "Tuesday"},
        { name: "wednesday", label: "Wednesday"},
        { name: "thursday", label: "Thursday"},
        { name: "friday", label: "Friday"},
        { name: "saturday", label: "Saturday"},
        { name: "sunday", label: "Sunday"},
    ];

    // use the date-fns component here
    return (
        <div>
            <div className="calendar-list">
                {days.map()}
            </div>
        </div>
    );
};