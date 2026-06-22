import React, { useState } from 'react';
import './ClubGrid.css';
import heartEmpty from '/src/assets/empty_heart.png';
import heartFull from '/src/assets/full_heart.png';
import { apiFetch } from '../lib/api';
import { motion } from "framer-motion";
import { useGlobalStore } from "../lib/store";
import { useClubData } from '../context/useClubData';
import paperTexture from '/src/assets/white-paper-texture.jpg';
import posterPin from '/src/assets/poster_pin.png';
import Avatar from '../components/Avatar';


export const ClubGrid = ({ result, onExpand, hideHeart, hidePins }) => {
  const [animating, setAnimating] = useState(false);
  let GlobalValue = useGlobalStore((state) => state.GlobalValue);

  const { favoritesCache, invalidateFavoritesCache, friendMembershipMap, clubTopTags } = useClubData();

  // meant to determine if a particular card is liked or not, depending on if it 
  // is found in the partulcar liked table or all false if the user is not logged
  // in
  let liked = favoritesCache?.has(result.id) ?? false;

  const friendsInClub = friendMembershipMap?.get(result.id) || [];
  const topTags = clubTopTags?.get(result.id) || [];

  //if a user likes a club, refresh cache and add this favorite to it
  const updateFavorite = async (newLiked) => {
    try {
      if (newLiked) {
        await apiFetch('/me/favorites', { method: 'POST', body: { club_id: result.id } });
        invalidateFavoritesCache(result.id, true);
      } else {
        await apiFetch(`/me/favorites/${result.id}`, { method: 'DELETE' });
        invalidateFavoritesCache(result.id, false);
      }
    } catch (err) {
      console.error(`Error ${newLiked ? 'adding' : 'removing'} favorite:`, err);
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
      onExpand(result);
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
      layoutId={`club-${result.id}`}
>
      {!hidePins && <img src={posterPin} alt="" className="pin pin-left" />}
      {!hidePins && <img src={posterPin} alt="" className="pin pin-right" />}
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
              <Avatar
                key={friend.id}
                url={friend.avatar_url}
                firstName={friend.first_name}
                lastName={friend.last_name}
                size={24}
                className="friend-avatar-img"
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
          {topTags.length > 0 && (
            <p>{topTags[0]}{topTags[1] && <span style={{marginLeft: '.5rem'}}>{topTags[1]}</span>}</p>
          )}
        </div>
      </div>
    </motion.button>
);
};

export default React.memo(ClubGrid);