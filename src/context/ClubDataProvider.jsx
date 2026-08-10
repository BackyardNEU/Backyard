import React, { useReducer, useEffect, useCallback, useRef, useMemo } from 'react';
import { ClubDataContext } from './ClubDataContext';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';

const initialState = {
    allData: [],
    loading: true,
    favoritesCache: null,
    userId: null,
    friendMembershipMap: new Map(),
    friendsArray: [],
    clubTopTags: new Map(),
    // The signed-in user's own profile row. Fetched here rather than by each consumer:
    // it was previously requested independently by ProfilePage, LoginMorph,
    // CalendarModule, and three separate Settings sections, so simply opening Settings
    // issued the same request three times.
    profile: null
};

function reducer(state, action) {
    switch (action.type) {
        case 'FETCH_COMPLETE':
            return { ...state, ...action.payload, loading: false };
        case 'SET_PROFILE':
            return { ...state, profile: { ...(state.profile ?? {}), ...action.patch } };
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

        let newAllData = [];
        let newFavoritesCache = new Set();
        let newUserId = null;
        let newProfile = null;
        let newFriendMembershipMap = new Map();
        let newFriendsArray = [];

        // Tier 1: independent fetches fire together. allSettled keeps one failure
        // from killing the rest — matches the old per-fetch try/catch behavior.
        const [clubsResult, userResult] = await Promise.allSettled([
            apiFetch('/clubs'),
            supabase.auth.getUser(),
        ]);

        if (clubsResult.status === 'fulfilled') {
            newAllData = clubsResult.value;
            console.log("successful fetching from server");
        } else {
            console.error("Error fetching from server: " + clubsResult.reason);
        }

        const userData = userResult.status === 'fulfilled' ? userResult.value.data : null;
        if (userData?.user) {
            newUserId = userData.user.id;

            // Tier 2: needs the user, but favorites and friends are independent of each other.
            const [favResult, friendsResult, profileResult] = await Promise.allSettled([
                apiFetch('/me/favorites'),
                apiFetch('/me/friends'),
                apiFetch('/me/profile'),
            ]);

            if (profileResult.status === 'fulfilled') {
                newProfile = profileResult.value;
            } else {
                console.error("Error retrieving profile:", profileResult.reason);
            }

            if (favResult.status === 'fulfilled') {
                const favData = favResult.value;
                newFavoritesCache = new Set((favData || []).map((fav) => fav.club_id));
                console.log("Favorites loaded:", favData.length);
            } else {
                console.error("Error retrieving favorites:", favResult.reason);
            }

            if (friendsResult.status === 'fulfilled') {
                const friendProfiles = friendsResult.value;
                newFriendsArray = (friendProfiles || []).map((f) => ({
                    id: f.id,
                    username: f.username,
                    avatar_url: f.avatar_url,
                    first_name: f.first_name,
                    last_name: f.last_name,
                }));
                for (const friend of friendProfiles || []) {
                    const clubs = friend.member_list || [];
                    for (const clubId of clubs) {
                        if (!newFriendMembershipMap.has(clubId)) newFriendMembershipMap.set(clubId, []);
                        newFriendMembershipMap.get(clubId).push({
                            id: friend.id,
                            username: friend.username,
                            avatar_url: friend.avatar_url,
                            first_name: friend.first_name,
                            last_name: friend.last_name,
                        });
                    }
                }
            } else {
                console.error("Error retrieving friends:", friendsResult.reason);
            }
        }

        // single dispatch — one render
        dispatch({
            type: 'FETCH_COMPLETE',
            payload: {
                allData: newAllData,
                favoritesCache: newFavoritesCache,
                userId: newUserId,
                friendMembershipMap: newFriendMembershipMap,
                friendsArray: newFriendsArray,
                profile: newProfile,
            }
        });
    }, []);

    // called by favorite button handlers — single dispatch, one render
    const invalidateFavoritesCache = useCallback((clubId, isAdding) => {
        dispatch({ type: 'SET_FAVORITES', clubId, isAdding });
    }, []);

    // Lets a component that just PUT /me/profile push the result back into the shared
    // copy, so every other consumer updates without another round trip.
    const setProfile = useCallback((patch) => {
        dispatch({ type: 'SET_PROFILE', patch });
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
        friendsArray: state.friendsArray,
        clubTopTags: state.clubTopTags,
        profile: state.profile,
        setProfile,
        invalidateFavoritesCache,
        refetch: fetchAllData
    }), [state, invalidateFavoritesCache, fetchAllData]);

    return (
        <ClubDataContext.Provider value={contextValue}>
            {children}
        </ClubDataContext.Provider>
    );
};
