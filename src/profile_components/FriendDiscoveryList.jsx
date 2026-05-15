import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { FaSearch, FaTimes } from 'react-icons/fa';
import './FriendDiscoveryList.css';

export const FriendDiscoveryList = ({ userId }) => {
  const [friends, setFriends] = useState([]);
  const [friendIds, setFriendIds] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [addingId, setAddingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchFriends = useCallback(async () => {
    if (!userId) return;

    // /me/friends already returns full profile rows for each friend, so we collapse
    // the previous two-round-trip (friend_list, then profiles by id) into one call.
    try {
      const friendProfiles = await apiFetch('/me/friends');
      setFriends(friendProfiles || []);
      setFriendIds((friendProfiles || []).map((f) => f.id));
    } catch (err) {
      console.error('Error fetching friends:', err);
    }
  }, [userId]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  useEffect(() => {
    if (!searchInput.trim()) {
      setSearchResults([]);
      return;
    }

    async function searchUsers() {
      try {
        const data = await apiFetch(`/users/search?q=${encodeURIComponent(searchInput)}`);
        setSearchResults(data || []);
      } catch (err) {
        console.error('Error searching users:', err);
      }
    }

    searchUsers();
  }, [searchInput, userId]);

  async function handleAddFriend(friendId) {
    if (addingId) return;
    setAddingId(friendId);

    if (friendIds.includes(friendId)) {
      setAddingId(null);
      return;
    }

    // PUT replaces the whole friend_list. If two tabs add concurrently, last write wins
    // — same behavior as the previous supabase-based code.
    const newList = [...friendIds, friendId];

    try {
      await apiFetch('/me/friends', { method: 'PUT', body: { friend_list: newList } });
      setFriendIds(newList);
      await fetchFriends();
    } catch (err) {
      console.error('Error adding friend:', err);
    }
    setAddingId(null);
  }

  async function handleRemoveFriend(friendId) {
    if (addingId) return;
    setAddingId(friendId);

    const newList = friendIds.filter((id) => id !== friendId);

    try {
      await apiFetch('/me/friends', { method: 'PUT', body: { friend_list: newList } });
      setFriendIds(newList);
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
          <div className="friend-card" key={friend.id}>
            <img
              className="friend-avatar"
              src={friend.avatar_url || '/raccoon_pfp.png'}
              alt={friend.username}
            />
            <span className="friend-card-name">{friend.username}</span>
          </div>
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
                      <img
                        className="friend-avatar-sm"
                        src={person.avatar_url || '/raccoon_pfp.png'}
                        alt={person.username}
                      />
                      <span className="friend-result-name">{person.username}</span>
                      {alreadyFriend ? (
                        <span className="friend-already-tag">Added</span>
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
                    <img
                      className="friend-avatar-sm"
                      src={friend.avatar_url || '/raccoon_pfp.png'}
                      alt={friend.username}
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
    </div>
  );
};

export default FriendDiscoveryList;
