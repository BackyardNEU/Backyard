import React, { useState } from 'react';
import { ClubGrid } from './ClubGrid';
import ExpandedTile from "./ExpandedTile";
import './ClubList.css';
import { AnimatePresence, motion } from "framer-motion";

export const ClubList = ({ results }) => {
  const [expandedClub, setExpandedClub] = useState(null);
 
  
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
          isExpanded={expandedClub?.id === club.id}
          onExpand={() => setExpandedClub(club)}
        />
      ))}
    </div>
  
    {expandedClub && (
      <ExpandedTile
        club = {expandedClub}
        key = {expandedClub.id}
        onClose={() => setExpandedClub(null)}
    />)}
    </AnimatePresence>
    </>
  );
};