import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { FaSearch, FaTimes } from 'react-icons/fa';
import './FriendDiscoveryList.css';
import { useClubData } from '../context/useClubData';
import Avatar from '../components/Avatar';

export const FriendDiscoveryList = ({ userId }) => {
  const navigate = useNavigate();
  const [friends, setFriends] = useState([]);
  const [friendIds, setFriendIds] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [addingId, setAddingId] = useState(null);
  const [pendingIds, setPendingIds] = useState(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // ClubDataProvider already loaded /me/friends, and it carries exactly the three fields
  // rendered here — id, username, avatar_url. Fetching it again on mount meant every visit
  // to a profile page re-requested a list the app was already holding.
  //
  // Kept in local state so add and remove can update optimistically without waiting on a
  // provider-wide refetch, and re-synced whenever the shared list changes.
  const { friendsArray } = useClubData();

  useEffect(() => {
    setFriends(friendsArray);
    setFriendIds(friendsArray.map((f) => f.id));
  }, [friendsArray]);

  useEffect(() => {
    apiFetch('/friend-requests/sent-pending')
      .then((ids) => setPendingIds(new Set(ids)))
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (!searchInput.trim()) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;

    // Debounce: this previously fired one /users/search per keystroke.
    const timer = setTimeout(async () => {
      try {
        const data = await apiFetch(`/users/search?q=${encodeURIComponent(searchInput)}`);
        // A newer query superseded this one while it was in flight.
        if (cancelled) return;
        setSearchResults(data || []);
      } catch (err) {
        if (!cancelled) console.error('Error searching users:', err);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchInput, userId]);

  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleAddFriend(friendId) {
    if (addingId || pendingIds.has(friendId) || friendIds.includes(friendId)) return;
    setAddingId(friendId);

    try {
      await apiFetch('/friend-requests', { method: 'POST', body: { recipientId: friendId } });
      setPendingIds((prev) => new Set([...prev, friendId]));
      showToast('Friend request sent!');
    } catch (err) {
      if (err.status === 409) {
        setPendingIds((prev) => new Set([...prev, friendId]));
      } else {
        console.error('Error sending friend request:', err);
      }
    }
    setAddingId(null);
  }

  async function handleRemoveFriend(friendId) {
    if (addingId) return;
    setAddingId(friendId);

    try {
      await apiFetch(`/me/friends/${friendId}`, { method: 'DELETE' });
      setFriendIds((prev) => prev.filter((id) => id !== friendId));
      setFriends((prev) => prev.filter((f) => f.id !== friendId));
    } catch (err) {
      console.error('Error removing friend:', err);
    }
    setAddingId(null);
  }

  function openModal() {
    setSearchInput('');
    setSearchResults([]);
    setModalOpen(true);
  }

  function closeModal() {
    setSearchInput('');
    setSearchResults([]);
    setModalOpen(false);
  }

  return (
    <div className="friends-panel">
      {/* Clean friend cards + Find More button */}
      <div className="friends-scroll">
        {friends.map((friend) => (
          <button
            type="button"
            className="friend-card friend-card-button"
            key={friend.id}
            onClick={() => navigate(`/friend/${friend.id}`)}
            aria-label={`View ${friend.username}'s profile`}
          >
            <Avatar
              className="friend-avatar"
              url={friend.avatar_url}
              firstName={friend.first_name}
              lastName={friend.last_name}
              username={friend.username}
            />
            <span className="friend-card-name">{friend.username}</span>
          </button>
        ))}
        <button className="find-friends-card" onClick={openModal}>
          <span className="find-friends-plus">+</span>
          <span className="find-friends-label">
            {friends.length === 0 ? 'Find Friends' : 'Find More'}
          </span>
        </button>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="friends-modal-overlay" onClick={closeModal}>
          <div className="friends-modal" onClick={(e) => e.stopPropagation()}>
            <div className="friends-modal-header">
              <h3 className="friends-modal-title">Manage Friends</h3>
              <button className="friends-modal-close" onClick={closeModal}>
                <FaTimes />
              </button>
            </div>

            {/* Search */}
            <div className="friend-search-wrapper">
              <FaSearch className="friend-search-icon" />
              <input
                placeholder="Search for a friend"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                autoFocus
              />
            </div>

            {searchResults.length > 0 && (
              <div className="friend-search-results">
                {searchResults.map((person) => {
                  const alreadyFriend = friendIds.includes(person.id);
                  return (
                    <div className="friend-search-result" key={person.id}>
                      <Avatar
                        className="friend-avatar-sm"
                        url={person.avatar_url}
                        username={person.username}
                      />
                      <span className="friend-result-name">{person.username}</span>
                      {alreadyFriend ? (
                        <span className="friend-already-tag">Added</span>
                      ) : pendingIds.has(person.id) ? (
                        <span className="friend-already-tag">Requested</span>
                      ) : (
                        <button
                          className="friend-add-btn"
                          onClick={() => handleAddFriend(person.id)}
                          disabled={addingId === person.id}
                        >
                          {addingId === person.id ? '...' : 'Add Friend'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Current friends with remove */}
            <div className="friends-modal-section-title">Current Friends</div>
            {friends.length === 0 ? (
              <p className="friends-empty">No friends added yet.</p>
            ) : (
              <div className="friends-modal-list">
                {friends.map((friend) => (
                  <div className="friend-modal-row" key={friend.id}>
                    <Avatar
                      className="friend-avatar-sm"
                      url={friend.avatar_url}
                      firstName={friend.first_name}
                      lastName={friend.last_name}
                      username={friend.username}
                    />
                    <span className="friend-result-name">{friend.username}</span>
                    <button
                      className="friend-remove-btn"
                      onClick={() => handleRemoveFriend(friend.id)}
                      disabled={addingId === friend.id}
                    >
                      {addingId === friend.id ? '...' : 'Remove'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="friend-toast">{toast}</div>
      )}
    </div>
  );
};

export default FriendDiscoveryList;
