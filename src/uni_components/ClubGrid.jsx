import React, { useState } from 'react';
import './ClubGrid.css';
import heartEmpty from '/src/assets/empty_heart.png';
import heartFull from '/src/assets/full_heart.png';
import { apiFetch } from '../lib/api';
// eslint-disable-next-line no-unused-vars
import { motion } from "framer-motion";
import { useGlobalStore } from "../lib/store";
import { useClubData } from '../context/useClubData';
import { prefetchClubPage } from '../lib/clubPageCache';
//import paperTexture from '/src/assets/white-paper-texture.jpg';
import posterPin from '/src/assets/poster_pin.png';
import Avatar from '../components/Avatar';
const ClubGridCard = ({ result, onExpand, hideHeart, hidePins }) => {
  const [animating, setAnimating] = useState(false);
  const [favError, setFavError] = useState(null);
  const GlobalValue = useGlobalStore((state) => state.GlobalValue);

  const { favoritesCache, invalidateFavoritesCache, friendMembershipMap } = useClubData();

  // Whether this card is favorited. Derived straight from the shared cache — it used to be
  // a `let` that the click handler reassigned during render, which React never observes,
  // so the heart only ever changed because invalidateFavoritesCache happened to dispatch.
  const liked = favoritesCache?.has(result.id) ?? false;

  const friendsInClub = friendMembershipMap?.get(result.id) || [];

  const handleHeartClick = async (e) => {
    e.stopPropagation();
    if (!GlobalValue) return;

    const next = !liked;
    setAnimating(true);
    setFavError(null);

    // Flip the shared cache first so the heart responds immediately, then reconcile.
    invalidateFavoritesCache(result.id, next);

    try {
      if (next) {
        await apiFetch('/me/favorites', { method: 'POST', body: { club_id: result.id } });
      } else {
        await apiFetch(`/me/favorites/${result.id}`, { method: 'DELETE' });
      }
    } catch (err) {
      // Roll back, so the heart shows what the server actually has rather than silently
      // disagreeing with it. Previously every failure was swallowed into console.error,
      // which is why a rate-limited click looked identical to a button that does nothing.
      invalidateFavoritesCache(result.id, !next);
      setFavError(err?.status === 429 ? err.message : 'Could not save that. Try again.');
      console.error(`Error ${next ? 'adding' : 'removing'} favorite:`, err);
    } finally {
      setTimeout(() => setAnimating(false), 250);
    }
  };

  const handleExpand = () => {
    if (onExpand) onExpand(result);
  };

  // Warm the club's page data on intent, so ExpandedTile mounts with content instead of
  // animating open against an empty shell. Hover covers pointer devices; pointerdown is
  // the touch fallback, and still buys the ~100ms between finger-down and click.
  // prefetchClubPage dedupes, so firing from both is free.
  const warm = () => prefetchClubPage(result.id);
  const truncate = (text, wordLimit = 5) => {
    if (!text) return "";
    const words = String(text).split(/\s+/).filter(Boolean);
    if (words.length <= wordLimit) return String(text);
    return words.slice(0, wordLimit).join(" ") + "...";
  };

  // No layoutId on the card: it paired this element with the expanded tile as a
  // shared-element morph, and framer-motion interpolating between a small square card and
  // a full-viewport panel is what produced the distortion on open. The tile does a plain
  // pop now. Dropping it also means resizing the grid via the density toggle settles
  // instantly instead of animating every card's layout at once.
  return (

    <motion.button
      className = "club-card"
      onClick = {handleExpand}
      onMouseEnter={warm}
      onFocus={warm}
      onPointerDown={warm}
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
        {favError && <div className="club-fav-error">{favError}</div>}
        {GlobalValue && friendsInClub.length > 0 && (
          <div className="friend-avatars">
            {friendsInClub.slice(0, 3).map((friend) => (
              <Avatar
                key={friend.id}
                url={friend.avatar_url}
                firstName={friend.first_name}
                lastName={friend.last_name}
                username={friend.username}
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
        </div>
      </div>
    </motion.button>
);
};

// Memoize on the *named* export as well. Both call sites (ClubList and
// ClubMembershipPanel) import { ClubGrid }, so memoizing only the default export meant
// the memo was never actually used — every card re-rendered on any parent update.
export const ClubGrid = React.memo(ClubGridCard);
export default ClubGrid;