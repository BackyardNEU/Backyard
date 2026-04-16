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
            <h1 className="current-month">{format(today, 'MMMM')}</h1>
            <div className="calendar-container">
                {days.map((day) => (
                    <div key={day.date.toISOString()} className={`calendar-day${day.isToday ? ' today' : ''}`}>
                        <div className="day-title-number">
                            <span>{day.label}</span><span>{day.sublabel}</span>
                        </div>
                        {day.events.length === 0 ? (                                                                                                              
                            <p>No events</p>                                                                                                                      
                        ) : (                                                                                                                                    
                            day.events.map(event => (
                                <div key={event.id} className="calendar-event">
                                    <img className="club-img" src={event.image_url}></img>
                                    <div className ="club-name">{event.club_name}</div>
                                    <div className ="event-description"><p>about<span  className="club-info">{event.event_description}</span></p></div>

                                    <div>
                                        <span>time </span>
                                        <span  className="club-info">{format(parseISO(event.start_time), 'h:mm a')} - {format(parseISO(event.end_time), 'h:mm a')}</span>
                                    </div>
                                     <p>interested <span className="club-info"> Milo</span></p>
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