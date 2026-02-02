import React, { useState, useEffect, useRef } from 'react';
import './ClubGrid.css';
import heartEmpty from '/src/assets/empty_heart.png';
import heartFull from '/src/assets/full_heart.png';
import { supabase } from '../supabase';
import { motion } from "framer-motion";
import { useGlobalStore } from "../store";


export const ClubGrid = ({ result, onExpand, isExpanded}) => {
  const [liked, setLiked] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [startAngle, setStartAngle] = useState(0);
  let GlobalValue = useGlobalStore((state) => state.GlobalValue);
  const cardRef = useRef(null);

  useEffect(() => {
    if (result.favorite !== undefined) {
      setLiked(result.favorite);
    }
  }, [result.favorite]);

  const updateFavorite = async (newLiked) => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      console.error('Error getting user', userError);
      return;
    }
    const userId = userData.user.id;
    if (liked == true) {
      const { error } = await supabase //possibly remove newLiked all together, not really necessary given the new supabase structure
        // .from("demo_club_data")
        // .update({ favorite: newLiked })
        // .eq("club_name", result.club_name);
        .from("user_favorites")
        .insert({ club_id: result.id, user_id: userId});

      if (error) console.error("Error updating favorite:", error);
    } else {
      const { error } = await supabase
        .from("user_favorites")
        .delete()
        .eq("club_id", result.id, "user_id", userId);

      if (error) console.error("Error removing favorite:", error);
    }
  };

  const handleHeartClick = async (e) => {
    e.stopPropagation();
    setAnimating(true);
    setLiked(!liked);
    await updateFavorite();
    setTimeout(() => setAnimating(false), 250);
  };

  

  const truncate = (text, wordLimit = 15) => {
    if (!text) return "";
    const words = String(text).split(/\s+/).filter(Boolean);
    if (words.length <= wordLimit) return String(text);
    return words.slice(0, wordLimit).join(" ") + "...";
  };

  return ( 

      <motion.button 
      className="club-card" 
      onClick = {onExpand}
      transition={{ duration: 0.3 }}
      layoutId = {`club-${result.id}`}
      whileHover = {{
        scale: 1.04,
        transition: {duration: 0.1},
        borderColor: '#eeeeeeff',
        boxShadow: '0 8px 20px rgba(171, 171, 171, 0.25)'
      }}

      >
        {GlobalValue ? <img
          className={`heart-btn ${animating ? 'pop' : ''}`}
          src={liked ? heartFull : heartEmpty}
          onClick={handleHeartClick}
        /> : null}
        <div className="club-img">🦝</div>
        <div className="club-info"> 
          <h2>{result.club_name}</h2>
          <p>{truncate(result.club_description)}</p>
        </div>
      </motion.button>

);
};