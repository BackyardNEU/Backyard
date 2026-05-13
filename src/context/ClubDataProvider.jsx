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
    clubTopTags: new Map()
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
        let newFriendsArray = [];

        try {
            newAllData = await apiFetch('/clubs');
            console.log("succesful fetching from server");
        }
        catch (err) {
            console.error("Error fetching from server: " + err);
        }


        // TODO(api): no aggregate endpoint exists for review tags across all clubs.
        // Options: (a) add GET /api/reviews/tags returning [{club_id, review_tags}, ...],
        // or (b) precompute top tags inside GET /api/clubs so this round trip disappears.
        // Leaving the direct supabase call for now so the loading screen still works.
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
            newUserId = userData.user.id;

            try {
                const favData = await apiFetch('/me/favorites');
                newFavoritesCache = new Set((favData || []).map((fav) => fav.club_id));
                console.log("Favorites loaded:", favData.length);
            } catch (err) {
                console.error("Error retrieving favorites:", err);
            }

            // /me/friends returns full friend profiles in one call — collapses the old
            // two-step (read friend_list, then fetch profiles by id).
            try {
                const friendProfiles = await apiFetch('/me/friends');
                newFriendsArray = (friendProfiles || []).map((f) => ({
                    id: f.id,
                    username: f.username,
                    avatar_url: f.avatar_url,
                }));
                for (const friend of friendProfiles || []) {
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
            } catch (err) {
                console.error("Error retrieving friends:", err);
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
                friendsArray: newFriendsArray,
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
        friendsArray: state.friendsArray,
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
