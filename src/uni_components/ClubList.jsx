import React, { useState } from 'react';
import { ClubGrid } from './ClubGrid';
import ExpandedTile from "./ExpandedTile";
import './ClubList.css';

export const ClubList = ({ results }) => {
  const [expandedClub, setExpandedClub] = useState(null);
  
  if ( !results || results.length === 0) {
    return <p>No clubs found.</p>;
  }

  return (
    <>
    <div className="clubs-list">
      {results.map((club) => (
        <ClubGrid 
          key={club.id} 
          result={club} 
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
    </>
  );
};