import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import './FriendSuggestions.css';

// ── Individual suggestion card ───────────────────────────────────────────────

const SuggestionCard = React.memo(({ person, onAdd, onDismiss, isAdding }) => {
  const navigate = useNavigate();
  const [photoIndex, setPhotoIndex] = useState(0);

  // Build the photo list: prefer user photos, fall back to avatar, then raccoon
  const photos =
    person.photos?.length > 0
      ? person.photos
      : person.avatar_url
        ? [person.avatar_url]
        : ['/raccoon_pfp.png'];

  // Display name: prefer real name over username
  const displayName =
    [person.first_name, person.last_name].filter(Boolean).join(' ') ||
    person.username ||
    'Unknown';

  // Grad year as "'29" format
  const gradYear = person.graduation_year
    ? `'${String(person.graduation_year).slice(-2)}`
    : null;

  function handleCardClick() {
    navigate(`/friend/${person.id}`);
  }

  function handleDotClick(e, i) {
    e.stopPropagation();
    setPhotoIndex(i);
  }

  return (
    <div
      className="suggestion-card"
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleCardClick()}
      aria-label={`View ${displayName}'s profile`}
    >
      {/* ── Photo area ── */}
      <div className="suggestion-photo-area">
        <img
          className="suggestion-photo"
          src={photos[photoIndex]}
          alt={displayName}
          onError={(e) => { e.currentTarget.src = '/raccoon_pfp.png'; }}
        />

        {/* Dismiss (×) button */}
        <button
          className="suggestion-dismiss"
          onClick={(e) => { e.stopPropagation(); onDismiss(person.id); }}
          aria-label="Dismiss suggestion"
        >
          ×
        </button>

        {/* Carousel dots — only rendered when there is more than one photo */}
        {photos.length > 1 && (
          <div className="suggestion-dots" aria-hidden="true">
            {photos.map((_, i) => (
              <button
                key={i}
                className={`suggestion-dot${i === photoIndex ? ' active' : ''}`}
                onClick={(e) => handleDotClick(e, i)}
                tabIndex={-1}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Info area ── */}
      <div className="suggestion-info">
        <div className="suggestion-text-col">
          <div className="suggestion-name">{displayName}</div>
          {person.mutual_count > 0 && (
            <div className="suggestion-meta">
              {person.mutual_count} Mutual{person.mutual_count !== 1 ? 's' : ''}
            </div>
          )}
          {gradYear && (
            <div className="suggestion-meta">{gradYear}</div>
          )}
        </div>

        <button
          className="suggestion-add-btn"
          onClick={(e) => { e.stopPropagation(); onAdd(person.id); }}
          disabled={isAdding}
          aria-label={`Add ${displayName} as friend`}
        >
          {isAdding ? '…' : '+'}
        </button>
      </div>

      <div className="suggestion-view-prompt">Click to view profile</div>
    </div>
  );
});

SuggestionCard.displayName = 'SuggestionCard';

// ── Main component ────────────────────────────────────────────────────────────

export const FriendSuggestions = ({ userId }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState(null);

  const dismissedKey = `suggestions_dismissed_${userId}`;

  const loadSuggestions = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await apiFetch('/me/friends/suggestions');
      const dismissed = new Set(
        JSON.parse(localStorage.getItem(dismissedKey) || '[]')
      );
      setSuggestions((data || []).filter((s) => !dismissed.has(s.id)));
    } catch (err) {
      console.error('Error fetching friend suggestions:', err);
    }
    setLoading(false);
  }, [userId, dismissedKey]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  async function handleAdd(personId) {
    if (addingId) return;
    setAddingId(personId);
    try {
      // Fetch fresh friend list to avoid stomping concurrent changes
      const profile = await apiFetch('/me/profile');
      const currentIds = profile.friend_list || [];
      if (!currentIds.includes(personId)) {
        await apiFetch('/me/friends', {
          method: 'PUT',
          body: { friend_list: [...currentIds, personId] },
        });
      }
      // Remove from suggestions — they're a friend now
      setSuggestions((prev) => prev.filter((s) => s.id !== personId));
    } catch (err) {
      console.error('Error adding friend from suggestions:', err);
    }
    setAddingId(null);
  }

  function handleDismiss(personId) {
    const current = JSON.parse(localStorage.getItem(dismissedKey) || '[]');
    localStorage.setItem(
      dismissedKey,
      JSON.stringify([...new Set([...current, personId])])
    );
    setSuggestions((prev) => prev.filter((s) => s.id !== personId));
  }

  // Hide the whole section while loading or when there's nothing to show
  if (loading || suggestions.length === 0) return null;

  return (
    <div className="profile-section suggestions-panel">
      <h2 className="profile-divider-header">People You May Know</h2>
      <div className="suggestions-scroll">
        {suggestions.map((person) => (
          <SuggestionCard
            key={person.id}
            person={person}
            onAdd={handleAdd}
            onDismiss={handleDismiss}
            isAdding={addingId === person.id}
          />
        ))}
      </div>
    </div>
  );
};

export default FriendSuggestions;
