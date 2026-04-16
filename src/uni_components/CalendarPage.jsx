import React, { useState, useEffect } from 'react';
import { useClubData } from '../context/useClubData';
import { CalendarList } from './CalendarList';
import { supabase } from '../supabase';
import './CalendarPage.css';

export const CalendarPage = () => {
    // grab relevant data from global context
    const { favoritesCache, userId } = useClubData();

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

    const [ warning, setWarning ] = useState("");

    // first: we need to check and see if the user has any clubs
    useEffect(() => {
        // check if user is logged in and if they have no favorites -> They need to log in or get favorites
        if (!userId || favoritesCache.size === 0) {
            return; //TODO: Render only a div if the user is logged in (only logged in users can use this page)
        }
        // If the user has no favorites, display a message in the warning div and pass an empty array to the CalendarList component
        else {
            setWeeklyEventsCache(null); // reset so the next block re-fetches
        }
    }, [favoritesCache]); // if userFavorites changes, then we set weeklyEventsCache to null to refresh it

    useEffect(() => {
        // make sure user is logged in, they have favorites, and that the weeklyEventsCache isnt null (otherwise there is data in there)
        if (!userId || favoritesCache.size === 0 || weeklyEventsCache !== null) {
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

    // meant to reflect a change in the fields in the react state
    const handleChange = (e) => {
        const { name, value } = e.target;
        setNewEvent(prev => ({ ...prev, [name]: value}));
    }

    function validateDate() {
        const { date, startTime, endTime } = newEvent;

        if (!date || !startTime || !endTime) {
            setWarning("Please fill in all date and time fields.");
            return false;
        }

        const startDateTime = new Date(date + "T" + startTime + ":00");
        const endDateTime   = new Date(date + "T" + endTime   + ":00");

        if (isNaN(startDateTime) || isNaN(endDateTime)) {
            setWarning("Invalid date or time format.");
            return false;
        }

        // get current time
        const now = new Date();

        if (startDateTime < now) {
            setWarning("Invalid date. Event cannot begin or end in the past.");
            return false;
        }

        if (startDateTime >= endDateTime) {
            setWarning("Start time must be before end time.");
            return false;
        }

        // Event cannot last more than 12 hours- Date objects are weird in that the substraction operation subtracts the difference in milliseconds, so we need to
        // adjust the comparison number
        if (endDateTime - startDateTime > 12 * 60 * 60 * 1000) {
            setWarning("Event cannot last more than 12 hours.");
            return false;
        }

        console.log("Date validated.");
        setWarning("");
        return true;
    }

    function validateInfo() {
        const { clubId, clubName, description } = newEvent;

        if (!clubId || !clubName || !description) {
            setWarning("Missing event info. Please fill out the required information.");
            return false;
        }

        console.log("Info validated.");
        setWarning("");
        return true;
    }

    // insert new event into event table
    // idea for the future: array for the demo_club_data table where an approved account for listing events will have their userId added to the list. This will make it
    // so the id of the club in the table and name can be determined from the unique uuid of the approved club account.
    // ALSO: One day: implement a draggable interface to show how long your event will last (kinda like when2meet)
    async function handleSubmit() {
        if (!validateDate() || !validateInfo()) return;

        const adjustedStart = newEvent.date + "T" + newEvent.startTime + ":00"; 
        const adjustedEnd = newEvent.date + "T" + newEvent.endTime + ":00";

        const { error } = await supabase
            .from('club_events')
            .insert({
                id_of_club: newEvent.clubId,
                club_name: newEvent.clubName,
                event_description: newEvent.description,
                start_time: adjustedStart,
                end_time: adjustedEnd
            });
        if (error){
             console.error("There was an issue adding your event:", error);
             console.error("code:", error.code, "message:", error.message, "details:", error.details, "hint:", error.hint);
             console.log(newEvent);
        }
        else {
            console.log("Success adding event!");
            setShowForm(false);
            setWeeklyEventsCache(null);
            setNewEvent({
                clubId: '', clubName: '', description: '', startTime: '', endTime: '', date: ''
            });
        }
    }
  
    //Note2self: when I implement the club field inputting interface, I need to replace the club name field with the club's id when they are logged into 
    //verified account
    return (
        <>
            <div className="whole-calendar-page">
                {!showForm && (                                                                                                                                   
                    <button onClick={() => { setShowForm(true); }} className="calendar-button">Click to add an event</button>
                )}
                {showForm && (  
                    <div>
                        <div>
                            <label>Copy and paste id *temp* <input type="text" value={newEvent.clubId} placeholder="id of club for now" name="clubId" onChange={handleChange} required /></label>
                            <label>Name of club: <input type="text" value={newEvent.clubName} placeholder="Club name" name="clubName" onChange={handleChange} required /></label>
                            <label>Event Description: <input type="text" value={newEvent.description} placeholder="Description" name="description" onChange={handleChange} required /></label>
                            <label>Start time: <input type="time" value={newEvent.startTime} placeholder="Start time" name="startTime" onChange={handleChange} required /></label>
                            <label>End time: <input type="time" value={newEvent.endTime} placeholder="End time" name="endTime" onChange={handleChange} required /></label>
                            <label>Date: <input type="date" value={newEvent.date} placeholder="yyyy-mm-dd" name="date" onChange={handleChange} required /></label>
                            <p>{warning}</p>
                            <button onClick={() => { setShowForm(false); setWarning(""); }} className="calendar-button">Cancel</button>
                            <button onClick={handleSubmit} class="calendar-button">Save</button>
                        </div>
                    </div>
                )}
                <CalendarList events={weeklyEventsCache ?? []} />
            </div>
        </>
    );
};
