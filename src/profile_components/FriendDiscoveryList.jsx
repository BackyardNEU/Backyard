import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
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

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('friend_list')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching friend_list:', error);
      return;
    }

    const list = profile?.friend_list || [];
    setFriendIds(list);

    if (list.length === 0) {
      setFriends([]);
      return;
    }

    const { data: friendProfiles, error: friendError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', list);

    if (friendError) {
      console.error('Error fetching friend profiles:', friendError);
      return;
    }

    setFriends(friendProfiles || []);
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
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .ilike('username', `%${searchInput}%`)
        .neq('id', userId)
        .limit(10);

      if (error) {
        console.error('Error searching users:', error);
        return;
      }

      setSearchResults(data || []);
    }

    searchUsers();
  }, [searchInput, userId]);

  async function handleAddFriend(friendId) {
    if (addingId) return;
    setAddingId(friendId);

    const { data: profile } = await supabase
      .from('profiles')
      .select('friend_list')
      .eq('id', userId)
      .single();

    let list = profile?.friend_list || [];

    if (list.includes(friendId)) {
      setAddingId(null);
      return;
    }

    list = [...list, friendId];

    const { error } = await supabase
      .from('profiles')
      .update({ friend_list: list })
      .eq('id', userId);

    if (error) {
      console.error('Error adding friend:', error);
    } else {
      setFriendIds(list);
      await fetchFriends();
    }
    setAddingId(null);
  }

  async function handleRemoveFriend(friendId) {
    if (addingId) return;
    setAddingId(friendId);

    const { data: profile } = await supabase
      .from('profiles')
      .select('friend_list')
      .eq('id', userId)
      .single();

    let list = profile?.friend_list || [];
    list = list.filter((id) => id !== friendId);

    const { error } = await supabase
      .from('profiles')
      .update({ friend_list: list })
      .eq('id', userId);

    if (error) {
      console.error('Error removing friend:', error);
    } else {
      setFriendIds(list);
      setFriends((prev) => prev.filter((f) => f.id !== friendId));
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
