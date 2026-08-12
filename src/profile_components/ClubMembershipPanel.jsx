import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { cachedFetch } from '../lib/queryCache';
import { useClubData } from '../context/useClubData';
import { ClubGrid } from '../uni_components/ClubGrid';
import ExpandedTile from '../uni_components/ExpandedTile';
import { AnimatePresence } from 'framer-motion';
import './ClubMembershipPanel.css';

export const ClubMembershipPanel = ({ userId, memberList, readOnly = false }) => {
  const { allData } = useClubData();
  const [memberClubs, setMemberClubs] = useState([]);
  const [expandedClub, setExpandedClub] = useState(null);

  useEffect(() => {
    if (!allData.length) return;

    // When memberList is passed in (e.g. viewing a friend's profile), use it
    // directly instead of calling /me/membership — that endpoint only ever
    // returns the current user's memberships.
    if (memberList !== undefined) {
      const list = memberList || [];
      const clubs = allData.filter((club) => list.includes(club.id));
      setMemberClubs(clubs);
      return;
    }

    if (!userId) return;

    async function fetchMemberships() {
      try {
        const { member_list } = await cachedFetch('me:membership', () => apiFetch('/me/membership'));
        const list = member_list || [];
        const clubs = allData.filter((club) => list.includes(club.id));
        setMemberClubs(clubs);
      } catch (err) {
        console.error('Error fetching member_list:', err);
      }
    }

    fetchMemberships();
  }, [userId, allData, memberList]);

  if (!memberClubs.length) {
    return (
      <div className="membership-panel">
        <p className="membership-empty">
          {readOnly ? 'No clubs joined yet.' : "You haven't joined any clubs yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="membership-panel">    <AnimatePresence>
        <div className="membership-scroll">
          {memberClubs.map((club) => (
            <div className="membership-card-wrapper" key={club.id}>
              <ClubGrid
                result={club}
                onExpand={() => setExpandedClub(club)}
                hideHeart
                hidePins
                showBorder
              />
            </div>
          ))}
        </div>

        {expandedClub && (
          <ExpandedTile
            club={expandedClub}
            key={expandedClub.id}
            onClose={() => setExpandedClub(null)}
            onMembershipChange={(clubId, joined) => {
              // In read-only mode this panel is showing someone else's
              // memberships, so the viewer joining/leaving a club shouldn't
              // mutate the list.
              if (readOnly) return;
              if (!joined) {
                setMemberClubs((prev) => prev.filter((c) => c.id !== clubId));
                setExpandedClub(null);
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ClubMembershipPanel;