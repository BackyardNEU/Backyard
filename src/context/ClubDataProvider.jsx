import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ClubDataContext } from './ClubDataContext';
import { supabase } from '../supabase';

export const ClubDataProvider = ({ children }) => {
    const [allData, setAllData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [favoritesCache, setFavoritesCache] = useState(null);
    const [userId, setUserId] = useState(null);
    const isFetching = useRef(false);

    // initial fetching of data from supabase
    const fetchAllData = useCallback(async () => {
        if (isFetching.current) {
            console.log("Fetch already in progress, skipping.");
            return;
        }
        isFetching.current = true;

        console.log("Fetching data from Supabase: this should only occur once unless switchting to favorites tab.");
        setLoading(true);
        // fetch data
        const { data, error } = await supabase
            .from('demo_club_data')
            .select('*');
        if (error) {
            console.error("Error retrieving data: " + error);
        }
        else {
            console.log("Success retrieving data");
            setAllData(data);
        }

        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) { // check if user is logged in/has an account
            const { data: favData, error: favError } = await supabase
                .from('user_favorites')
                .select('club_id')
                .eq('user_id', userData.user.id);

            if (favError) {
                console.error("Error retrieving favorites:", favError);
            } else {
                // use set for fast .has() lookups
                setFavoritesCache(new Set(favData.map(fav => fav.club_id)));
                console.log("Favorites loaded:", favData.length);

                //setUserID for use later
                setUserId(userData.user.id);
            }
        } else {
            // empty Set if the user is not logged in
            setFavoritesCache(new Set());
        }

        // all necessary data needed: loading stops
        setLoading(false);
    }, []);

    // method to be called by favorite button handler function to update the favorites cache
    const invalidateFavoritesCache = useCallback(async (clubId, isAdding) => {
        setFavoritesCache(prev => {
            const next = new Set(prev);
            if (isAdding) {
                next.add(clubId);
            } else {
                next.delete(clubId);
            }
            return next;
        });
    }, []);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // return the context
    return (
        <ClubDataContext.Provider value={{
            allData,
            loading,
            favoritesCache,
            userId,
            setFavoritesCache,
            invalidateFavoritesCache,
            refetch: fetchAllData
        }}>
            {children}
        </ClubDataContext.Provider>
    );
};