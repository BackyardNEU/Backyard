import React, { useState, useEffect, useRef } from 'react';
import './ClubGrid.css';
import heartEmpty from '/src/assets/empty_heart.png';
import heartFull from '/src/assets/full_heart.png';
import { supabase } from '../supabase';
import { motion } from "framer-motion";
import { useGlobalStore } from "../store";
import { useClubData } from '../context/useClubData';

export const ClubGrid = ({ result, onExpand }) => {
  const [liked, setLiked] = useState(false);
  const [animating, setAnimating] = useState(false);
  let GlobalValue = useGlobalStore((state) => state.GlobalValue);

  const { invalidateFavoritesCache } = useClubData();

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

    if (newLiked) {
      const { error } = await supabase
        .from("user_favorites")
        .insert({ club_id: result.id, user_id: userId });

      if (error) console.error("Error adding favorite:", error);
      else {
        console.log("NEW CLUB LIKED RESETTING FAVORITES CACHE");
        invalidateFavoritesCache();
      }
    } else {
      const { error } = await supabase
        .from("user_favorites")
        .delete()
        .match({ club_id: result.id, user_id: userId });

      if (error) console.error("Error removing favorite:", error);
      else {
        console.log("NEW CLUB DISLIKED RESETTING FAVORITES CACHE");
        invalidateFavoritesCache();
      }
    }
  };

  const handleHeartClick = async (e) => {
    console.log("heart button clicked");
    e.stopPropagation();
    setAnimating(true);
    const newLiked = !liked;
    setLiked(newLiked);
    await updateFavorite(newLiked);
    setTimeout(() => setAnimating(false), 250);
  };


  const truncate = (text, wordLimit = 5) => {
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
      <div className = "flex-card">
        <div className = "image-container">
        <img className="club-img" src ={result.image_url}/>
        {GlobalValue ? <img
          className={`heart-btn ${animating ? 'pop' : ''}`}
          src={liked ? heartFull : heartEmpty}
          onClick={handleHeartClick}
        /> : null}
        </div>
        <div className="club-name"> 
          {truncate(result.club_name)}
        </div>
        <div className="club-info">
          <p>{result.email}</p>
        </div></div>
      </motion.button>
);
};