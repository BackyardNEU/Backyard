import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ClubDataContext } from './ClubDataContext';
import { supabase } from '../supabase';

export const ClubDataProvider = ({ children }) => {
    const [allData, setAllData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [favoritesCache, setFavoritesCache] = useState(null);
    const isFetching = useRef(false);

    const fetchAllData = useCallback(async () => {
        if (isFetching.current) {
            console.log("Fetch already in progress, skipping.");
            return;
        }
        isFetching.current = true;

        console.log("Fetching data from Supabase: this should only occur once unless switchting to favorites tab.");
        setLoading(true);
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
        setLoading(false);
    }, []);

    const invalidateFavoritesCache = useCallback(() => {
        setFavoritesCache(null);
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
            setFavoritesCache,
            invalidateFavoritesCache,
            refetch: fetchAllData
        }}>
            {children}
        </ClubDataContext.Provider>
    );
};