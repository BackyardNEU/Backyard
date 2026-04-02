import React, { useState, useEffect } from 'react';
import { useClubData } from '../context/useClubData';
import { CalendarList } from './CalendarList';
import { IconBar } from './IconBar';
import { getClubsBasedOnCategory } from './UniversityPage';
import { supabase } from '../supabase';
import './CalendarPage.css';

export const CalendarPage = () => {
    const { userFavorites } = useClubData();
    // contains all events for the next 7 days- THIS IS NOT THE CACHE
    const events = useState([]);
    // null means no reqeust was ever made -> request. Empty list implies no favorited clubs have events going on this week.
    const [ weeklyEventsCache, setWeeklyEventsCache ] = useState(null);

    // first: we need to check and see if the user has any clubs

    useEffect(() => {
        if (userFavorites.size() > 0) {
            return;
        }
        else if (weeklyEventsCache === null) {

        }

        const fetchEvents = async () => {
            const { data, error } = await supabase.rpc('get_weekly_events', {
                p_user_id: userId
            });
            if (error) {
                console.error("There was an issue retrieving the events: " + error);
            }
            else {

            }
        }

    }, [userId]);

    // allow for events to be added (deletion/alteration will come later)
    function addEvent() {
        
    }
  
    return (
        <div>
            <div>
                <button onClick={addEvent()}/>
                <CalendarList events={events} />
            </div>
            <IconBar onIconClick={getClubsBasedOnCategory} />
        </div>
    );
};
