import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ClubDataContext } from './ClubDataContext';
import { supabase } from '../supabase';

export const ClubDataProvider = ({ children }) => {
    const [allData, setAllData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [favoritesCache, setFavoritesCache] = useState(null);
    const [userId, setUserId] = useState(null);
    const [friendMembershipMap, setFriendMembershipMap] = useState(new Map());
    const [clubTopTags, setClubTopTags] = useState(new Map());
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

        // Fetch review tags and compute top 2 per club
        const { data: reviewTags, error: tagsError } = await supabase
            .from('reviews')
            .select('club_id, review_tags');
        if (!tagsError && reviewTags) {
            const tagCounts = {};
            for (const review of reviewTags) {
                if (!review.review_tags || !Array.isArray(review.review_tags)) continue;
                if (!tagCounts[review.club_id]) tagCounts[review.club_id] = {};
                for (const tag of review.review_tags) {
                    tagCounts[review.club_id][tag] = (tagCounts[review.club_id][tag] || 0) + 1;
                }
            }
            const topTagsMap = new Map();
            for (const [clubId, counts] of Object.entries(tagCounts)) {
                const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
                topTagsMap.set(clubId, sorted.slice(0, 2).map(([tag]) => tag));
            }
            setClubTopTags(topTagsMap);
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
                console.log("Favorites loaded: " + favoritesCache, favData.length);

                //setUserID for use later
                setUserId(userData.user.id);
            }

            // fetch friend memberships for avatar display on club cards
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('friend_list')
                .eq('id', userData.user.id)
                .single();

            const friendList = profileData?.friend_list || [];
            if (!profileError && friendList.length > 0) {
                const { data: friendProfiles, error: friendError } = await supabase
                    .from('profiles')
                    .select('id, username, avatar_url, member_list')
                    .in('id', friendList);

                if (!friendError && friendProfiles) {
                    const map = new Map();
                    for (const friend of friendProfiles) {
                        const clubs = friend.member_list || [];
                        for (const clubId of clubs) {
                            if (!map.has(clubId)) map.set(clubId, []);
                            map.get(clubId).push({
                                id: friend.id,
                                username: friend.username,
                                avatar_url: friend.avatar_url,
                            });
                        }
                    }
                    setFriendMembershipMap(map);
                }
            } else {
                setFriendMembershipMap(new Map());
            }
        } else {
            // empty Set if the user is not logged in
            setFavoritesCache(new Set());
            setFriendMembershipMap(new Map());
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
            friendMembershipMap,
            clubTopTags,
            setFavoritesCache,
            invalidateFavoritesCache,
            refetch: fetchAllData
        }}>
            {children}
        </ClubDataContext.Provider>
    );
};