import React from 'react';
import { startOfDay, addDays, format, isSameDay, parseISO } from 'date-fns';
import './CalendarList.css';

//events will be the array of club events happening that match a user's favorited clubs. If empty, no events will be displayed and a special message will appear.
export const CalendarList = ({ events }) => {
    const today = startOfDay(new Date());
                                                                                                                                                    
    const days = Array.from({ length: 7 }, (_, i) => {                                                                                              
        const date = addDays(today, i);
        
        const dayEvents = events                                                                                                                      
          .filter(event => isSameDay(parseISO(event.start_time), date))                                                                             
          .sort((a, b) => parseISO(a.start_time) - parseISO(b.start_time)); 

        return {                                                                                                                                    
            date,
            label: format(date, 'EEE'),   // "Mon"                                                                                                
            sublabel: format(date, 'd'), // "Apr 13"
            isToday: i === 0,
            events: dayEvents                                                                                                                         
        };                                                                                                                                          
    });          

    // use the date-fns component here
    return (
        <div>
            <h1 className="current-month">{format(today, 'MMMM - yyyy')}</h1>
            <div className="calendar-container">
                {days.map((day) => (
                    <div key={day.date.toISOString()} className={`calendar-day${day.isToday ? ' today' : ''}`}>
                        <span className="day-title">{day.label}</span>                                                                                                                  
                        <span>{day.sublabel}</span>
                        {day.events.length === 0 ? (                                                                                                              
                            <p>No events</p>                                                                                                                      
                        ) : (                                                                                                                                    
                            day.events.map(event => (
                                <div key={event.id}>
                                    <img></img>
                                    <div>{event.club_name}</div>
                                    <div>{event.event_description}</div>                                                                                                           
                                    <span>{format(parseISO(event.start_time), 'h:mm a')} - {format(parseISO(event.end_time), 'h:mm a')}</span>
                                </div>                                                                                                                            
                            ))                                                                                                                                  
                        )}                                                                                                                                        
                    </div>                                                                                                                      
                ))
                }
            </div>
        </div>
    );
};