import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useClubData } from '../context/useClubData';
import { ClubGrid } from '../uni_components/ClubGrid';
import ExpandedTile from '../uni_components/ExpandedTile';
import { AnimatePresence } from 'framer-motion';
import './ClubMembershipPanel.css';

export const ClubMembershipPanel = ({ userId }) => {
  const { allData } = useClubData();
  const [memberClubs, setMemberClubs] = useState([]);
  const [expandedClub, setExpandedClub] = useState(null);

  useEffect(() => {
    if (!userId || !allData.length) return;

    async function fetchMemberships() {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('member_list')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching member_list:', error);
        return;
      }

      const list = profile?.member_list || [];
      const clubs = allData.filter((club) => list.includes(club.id));
      setMemberClubs(clubs);
    }

    fetchMemberships();
  }, [userId, allData]);

  if (!memberClubs.length) {
    return (
      <div className="membership-panel">
      
        <p className="membership-empty">You haven't joined any clubs yet.</p>
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