import React, { useState } from 'react';
import { ClubGrid } from './ClubGrid';
import ExpandedTile from "./ExpandedTile";
import './ClubList.css';

export const ClubList = ({ results }) => {
  const [expandedClub, setExpandedClub] = useState(null);
  const [animating, setAnimating] = useState(false);
  
  if ( !results || results.length === 0) {
    return <p>No clubs found.</p>;
  }


  const handleCardClick = async (e) => {
    e.stopPropagation();
    setAnimating(true)
    setTimeout(() => setAnimating(false),250);
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