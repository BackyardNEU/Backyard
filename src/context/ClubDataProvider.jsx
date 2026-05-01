import React, { useReducer, useEffect, useCallback, useRef, useMemo } from 'react';
import { ClubDataContext } from './ClubDataContext';
import { supabase } from '../supabase';

const initialState = {
    allData: [],
    loading: true,
    favoritesCache: null,
    userId: null,
    friendMembershipMap: new Map(),
    clubTopTags: new Map(),
};

function reducer(state, action) {
    switch (action.type) {
        case 'FETCH_COMPLETE':
            return { ...state, ...action.payload, loading: false };
        case 'SET_FAVORITES': {
            const next = new Set(state.favoritesCache);
            if (action.isAdding) {
                next.add(action.clubId);
            } else {
                next.delete(action.clubId);
            }
            return { ...state, favoritesCache: next };
        }
        default:
            return state;
    }
}

export const ClubDataProvider = ({ children }) => {
    const [state, dispatch] = useReducer(reducer, initialState);
    const isFetching = useRef(false);

    const fetchAllData = useCallback(async () => {
        if (isFetching.current) {
            console.log("Fetch already in progress, skipping.");
            return;
        }
        isFetching.current = true;

        console.log("Fetching data from Supabase: this should only occur once unless switchting to favorites tab.");

        // collect all results before touching state
        let newAllData = [];
        let newClubTopTags = new Map();
        let newFavoritesCache = new Set();
        let newUserId = null;
        let newFriendMembershipMap = new Map();

        // fetch club data
        const { data, error } = await supabase
            .from('demo_club_data')
            .select('*');
        if (error) {
            console.error("Error retrieving data: " + error);
        } else {
            console.log("Success retrieving data");
            newAllData = data;
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
            for (const [clubId, counts] of Object.entries(tagCounts)) {
                const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
                newClubTopTags.set(clubId, sorted.slice(0, 2).map(([tag]) => tag));
            }
        }

        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
            const { data: favData, error: favError } = await supabase
                .from('user_favorites')
                .select('club_id')
                .eq('user_id', userData.user.id);

            if (favError) {
                console.error("Error retrieving favorites:", favError);
            } else {
                newFavoritesCache = new Set(favData.map(fav => fav.club_id));
                console.log("Favorites loaded:", favData.length);
                newUserId = userData.user.id;
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
                    for (const friend of friendProfiles) {
                        const clubs = friend.member_list || [];
                        for (const clubId of clubs) {
                            if (!newFriendMembershipMap.has(clubId)) newFriendMembershipMap.set(clubId, []);
                            newFriendMembershipMap.get(clubId).push({
                                id: friend.id,
                                username: friend.username,
                                avatar_url: friend.avatar_url,
                            });
                        }
                    }
                }
            }
        }

        // single dispatch — one render
        dispatch({
            type: 'FETCH_COMPLETE',
            payload: {
                allData: newAllData,
                clubTopTags: newClubTopTags,
                favoritesCache: newFavoritesCache,
                userId: newUserId,
                friendMembershipMap: newFriendMembershipMap,
            }
        });
    }, []);

    // called by favorite button handlers — single dispatch, one render
    const invalidateFavoritesCache = useCallback((clubId, isAdding) => {
        dispatch({ type: 'SET_FAVORITES', clubId, isAdding });
    }, []);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const contextValue = useMemo(() => ({
        allData: state.allData,
        loading: state.loading,
        favoritesCache: state.favoritesCache,
        userId: state.userId,
        friendMembershipMap: state.friendMembershipMap,
        clubTopTags: state.clubTopTags,
        invalidateFavoritesCache,
        refetch: fetchAllData
    }), [state, invalidateFavoritesCache, fetchAllData]);

    return (
        <ClubDataContext.Provider value={contextValue}>
            {children}
        </ClubDataContext.Provider>
    );
};
