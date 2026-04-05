import React, { useState, useEffect } from 'react';
import { useClubData } from '../context/useClubData';
import { CalendarList } from './CalendarList';
import { IconBar } from './IconBar';
import { getClubsBasedOnCategory } from './UniversityPage';
import { supabase } from '../supabase';
import './CalendarPage.css';

export const CalendarPage = () => {
    const { userFavorites, userId } = useClubData();

    // null means no reqeust was ever made -> request. Empty list implies no favorited clubs have events going on this week.
    const [ weeklyEventsCache, setWeeklyEventsCache ] = useState(null);

    // conditional render for form element
    const [ showForm, setShowForm ] = useState(false);

    // new event creator
    // Notes:
    // replace club_id and the club_name eventually because those will automatically be handled by taking the info directly from the verified club account users.
    const [ newEvent, setNewEvent] = useState({
        clubId: '',
        clubName: '', 
        description: '', 
        startTime: '', 
        endTime: '', 
        date: ''
    });

    // first: we need to check and see if the user has any clubs
    useEffect(() => {
        // check if user is logged in and if they have no favorites -> They need to log in or get favorites
        if (!userId || userFavorites.size === 0) {
            return; //TODO: Render only a div if the user is logged in (only logged in users can use this page)
        }
        // If the user has no favorites, display a message in the warning div and pass an empty array to the CalendarList component
        else {
            setWeeklyEventsCache(null); // reset so the next block re-fetches
        }
    }, [userFavorites]); // if userFavorites changes, then we set weeklyEventsCache to null to refresh it

    useEffect(() => {
        // make sure user is logged in, they have favorites, and that the weeklyEventsCache isnt null (otherwise there is data in there)
        if (!userId || userFavorites === 0 || weeklyEventsCache !== null) {
            return;
        }
        // fetch the events using the 
        const fetchEvents = async () => {
            const { data, error } = await supabase.rpc('get_weekly_events', {
                p_user_id: userId
            });
            if (error) {
                console.error("There was an issue retrieving the events: " + error);
            }
            else {
                setWeeklyEventsCache(data);
            }
        }
        fetchEvents();
    }, [userId, weeklyEventsCache]);

    // allow for events to be added (deletion/alteration will come later)
    function addEvent() {
        setShowForm(true);
    }

    const handleChange = (e) => {
        const { name, value } = e.target;
        setNewEvent(prev => ({ ...prev, [name]: value}));
    }

    async function handleSubmit() {
        const { error } = await supabase
            .from('club_events')
            .insert({
                id_of_club: newEvent.clubId,
                title: newEvent.clubName,
                
            });
    }
  
    //Note2self: when I implement the club field inputting interface, I need to replace the club name field with the club's id when they are logged in
    return (
        <div>
            <div>
                <button onClick={addEvent()}/>
                {showForm && (
                    <div>
                        <label>Copy and paste id *temp* <input type="text" value={newEvent.clubId} placeholder="id of club for now" name="clubId" /></label>
                        <label>Name of club: <input type="text" value={newEvent.clubName} placeholder="Club name" name="clubName" onChange={handleChange}/></label>
                        <label>Event Description: <input type="text" value={newEvent.description} placeholder="Description" name="description" onChange={handleChange}/></label>
                        <label>Start time: <input type="time" value={newEvent.startTime} placeholder="Start time" name="startTime" onChange={handleChange}/></label>
                        <label>End time: <input type="time" value={newEvent.endTime} placeholder="End time" name="endTime" onChange={handleChange}/></label>
                        <label>Date: <input type="date" value={newEvent.date} placeholder="yyyy-mm-dd" name="date" onChange={handleChange}/></label>
                        <button onClick={() => setShowForm(false)}>Cancel</button>
                        <button onClick={handleSubmit}>Save</button>
                    </div>
                )}
                <CalendarList events={weeklyEventsCache ?? []} />
            </div>
            <IconBar onIconClick={getClubsBasedOnCategory} />
        </div>
    );
};
