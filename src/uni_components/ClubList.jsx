import React, { useState, useCallback } from 'react';
import { ClubGrid } from './ClubGrid';
import ExpandedTile from "./ExpandedTile";
import './ClubList.css';
// eslint-disable-next-line no-unused-vars
import { AnimatePresence, motion } from "framer-motion";

export const ClubList = ({ results, cardSize = 'medium' }) => {
  const [expandedClub, setExpandedClub] = useState(null);
  const handleClose = useCallback(() => setExpandedClub(null), []);

  if ( !results || results.length === 0) {
    return <p>No clubs found.</p>;
  }

  return (
    <>
    <AnimatePresence>
      {/* data-size drives --card-scale and the column count; see ClubList.css. */}
      <div className="clubs-list" data-size={cardSize}>
        {results.map((club) => (

          <ClubGrid
            key={club.id}
            result={club}
            onExpand={setExpandedClub}
          />
        ))}
        </div>

        {expandedClub && (
          <ExpandedTile
            club={expandedClub}
            key={expandedClub.id}
            onClose={handleClose}
          />
        )}
    </AnimatePresence>
    </>
  );
};