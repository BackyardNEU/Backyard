import React, { useState } from 'react';
import './ClubGrid.css';
import heartEmpty from '/src/assets/empty_heart.png';
import heartFull from '/src/assets/full_heart.png';
import { supabase } from '../supabase';
import { motion } from "framer-motion";
import { useGlobalStore } from "../store";
import { useClubData } from '../context/useClubData';
import paperTexture from '/src/assets/white-paper-texture.jpg';
import posterPin from '/src/assets/poster_pin.png';


export const ClubGrid = ({ result, onExpand, hideHeart }) => {
  const [animating, setAnimating] = useState(false);
  let GlobalValue = useGlobalStore((state) => state.GlobalValue);

  const { favoritesCache, invalidateFavoritesCache, friendMembershipMap } = useClubData();

  // meant to determine if a particular card is liked or not, depending on if it 
  // is found in the partulcar liked table or all false if the user is not logged
  // in
  let liked = favoritesCache?.has(result.id) ?? false;

  const friendsInClub = friendMembershipMap?.get(result.id) || [];

  //if a user likes a club, refresh cache and add this favorite to it
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
        invalidateFavoritesCache(result.id, true);
      }
    } else {
      const { error } = await supabase
        .from("user_favorites")
        .delete()
        .match({ club_id: result.id, user_id: userId });

      if (error) console.error("Error removing favorite:", error);
      else {
        console.log("NEW CLUB DISLIKED RESETTING FAVORITES CACHE");
        invalidateFavoritesCache(result.id, false);
      }
    }
  };

  const handleHeartClick = async (e) => {
    console.log("heart button clicked");
    e.stopPropagation();
    setAnimating(true);
    liked = !liked;
    await updateFavorite(liked);
    setTimeout(() => setAnimating(false), 250);
  };

  const handleExpand = () => {
      onExpand();
  };
  const truncate = (text, wordLimit = 5) => {
    if (!text) return "";
    const words = String(text).split(/\s+/).filter(Boolean);
    if (words.length <= wordLimit) return String(text);
    return words.slice(0, wordLimit).join(" ") + "...";
  };

  return ( 

    <motion.button
      className = "club-card"
      onClick = {handleExpand}
      layoutId = {`club-${result.id}`}
>
      <img src={posterPin} alt="" className="pin pin-left" />
      <img src={posterPin} alt="" className="pin pin-right" />
      <div className = "flex-card">
        <div className = "image-container">
        <img className = "club-img" src={result.image_url || "/raccoon_pfp.png"}/>
        {!hideHeart && GlobalValue ? <img
          className = {`heart-btn ${animating ? 'pop' : ''}`}
          src = {liked ? heartFull : heartEmpty}
          onClick = {handleHeartClick}
        /> : null}
        </div>
        {GlobalValue && friendsInClub.length > 0 && (
          <div className="friend-avatars">
            {friendsInClub.slice(0, 3).map((friend) => (
              <img
                key={friend.id}
                className="friend-avatar-img"
                src={friend.avatar_url || "/raccoon_pfp.png"}
                alt={friend.username}
              />
            ))}
            {friendsInClub.length > 3 && (
              <span className="friend-avatar-overflow">
                +{friendsInClub.length - 3}
              </span>
            )}
          </div>
        )}
        <div className = "club-name"> 
          {truncate(result.club_name)}
        </div>
        <div className = "club-info">
          <p>{result.email}</p>
        </div>
      </div>
    </motion.button>

);
};