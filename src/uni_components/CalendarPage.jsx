import React, { useState, useEffect } from 'react';
import { useClubData } from '../context/useClubData';
import { CalendarList } from './CalendarList';
import { IconBar } from './IconBar';
import { getClubsBasedOnCategory } from './UniversityPage';
import './CalendarPage.css';

export const CalendarPage = () => {
    const { userFavorites } = useClubData();
    const [ noClubWarning, setNoClubWarning ] = useState("");
    // first: we need to check and see if the user has any clubs
    
    useEffect(() => {
            if (!userFavorites || userFavorites.size === 0) {
                setNoClubWarning("It appears you don't have any favorited clubs. Take a look and see what you like!");
            }   
        }, [userFavorites]
    );
  
    return (
        <div>
            <div>
                <p>{noClubWarning}</p> 
                <CalendarList />
            </div>
            <IconBar onIconClick={getClubsBasedOnCategory} />
        </div>
    );
};
