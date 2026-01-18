import React, { useState, useEffect, useRef } from 'react';
import './ClubGrid.css';
import heartEmpty from '/src/assets/empty_heart.png';
import heartFull from '/src/assets/full_heart.png';
import { supabase } from '../supabase';

export const ClubGrid = ({ result, onExpand }) => {
  const [liked, setLiked] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [startAngle, setStartAngle] = useState(0);
  const cardRef = useRef(null);

  useEffect(() => {
    if (result.favorite !== undefined) {
      setLiked(result.favorite);
    }
  }, [result.favorite]);

  const updateFavorite = async (newLiked) => {
    const { error } = await supabase
      .from("demo_club_data")
      .update({ favorite: newLiked })
      .eq("club_name", result.club_name);
    if (error) console.error("Error updating favorite:", error);
  };

  const handleHeartClick = async (e) => {
    e.stopPropagation();
    setAnimating(true);
    const newLiked = !liked;
    setLiked(newLiked);
    await updateFavorite(newLiked);
    setTimeout(() => setAnimating(false), 250);
  };

  

  const truncate = (text, wordLimit = 15) => {
    const words = text.split(" ");
    if (words.length <= wordLimit) return text;
    return words.slice(0, wordLimit).join(" ") + "...";
  };

  return (
    
  
      <div className="club-card" onClick={onExpand}>
        <img
          className={`heart-btn ${animating ? 'pop' : ''}`}
          src={liked ? heartFull : heartEmpty}
          onClick={handleHeartClick}
        />
        <div className="club-img">🦝</div>
        <div className="club-info">
          <h2>{result.club_name}</h2>
          <p>{truncate(result.club_description)}</p>
        </div>
      </div>
  );
};