import React, { useState, useCallback } from 'react';
import { ClubGrid } from './ClubGrid';
import ExpandedTile from "./ExpandedTile";
import './ClubList.css';
import { AnimatePresence, motion } from "framer-motion";

export const ClubList = ({ results }) => {
  const [expandedClub, setExpandedClub] = useState(null);
  const handleClose = useCallback(() => setExpandedClub(null), []);
 
  
  if ( !results || results.length === 0) {
    return <p>No clubs found.</p>;
  }


  return (
    <>
    <AnimatePresence>
      <div className="clubs-list">
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