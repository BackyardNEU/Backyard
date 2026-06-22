import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'
import { useGlobalStore } from '../lib/store'
import './ProfilePage.css'
import './FriendDiscoveryList.css'
import './FriendProfile.css'
import { ClubMembershipPanel } from './ClubMembershipPanel'
import { PolaroidCards } from './PolaroidCards'
import Avatar from '../components/Avatar'

// Read-only counterpart to ProfilePage. Renders another user's profile and the
// friends both viewers have in common. There is intentionally no avatar upload,
// no biography editor, and no Setup button — the page is purely consumption.
export const FriendProfile = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const lastPath = useGlobalStore((state) => state.lastPath)
  const [viewerId, setViewerId] = useState(null)
  const [profile, setProfile] = useState(null)
  const [status, setStatus] = useState('loading')
  const [errorMessage, setErrorMessage] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setStatus('loading')
      setErrorMessage(null)

      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (cancelled) return
      if (authError || !authData?.user) {
        navigate('/', { replace: true })
        return
      }

      const authUser = authData.user
      setViewerId(authUser.id)

      // Viewing /friend/<your-own-id> doesn't make sense — bounce to the
      // editable profile page instead.
      if (authUser.id === id) {
        navigate('/profile', { replace: true })
        return
      }

      try {
        const data = await apiFetch(`/users/${id}/profile`)
        if (cancelled) return
        setProfile(data)
        setStatus('ready')
      } catch (err) {
        if (cancelled) return
        console.error('Error fetching friend profile:', err)
        setErrorMessage(err?.status === 404 ? 'User not found.' : 'Could not load profile.')
        setStatus('error')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id, navigate])

  // Prefer the page the viewer was on before opening this profile; fall back
  // to their own profile so the close button is always meaningful.
  const handleClose = () => {
    const target = lastPath && lastPath !== window.location.pathname ? lastPath : '/profile'
    navigate(target)
  }

  if (status === 'loading') {
    return (
      <div className="ProfilePage">
        <div className="spacer" />
        <p className="friend-profile-status">Loading…</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="ProfilePage">
        <div className="spacer" />
        <button
          className="profile-close-btn"
          onClick={handleClose}
          aria-label="Close profile"
        >
          ×
        </button>
        <p className="friend-profile-status">{errorMessage}</p>
      </div>
    )
  }

  const profileDescription = profile?.biography ?? ''

  return (
    <div className="ProfilePage">
      <div className="spacer" />
      <div className="profile-header">
        <div className="friend-photo-wrap">
          <Avatar
            url={profile?.avatar_url}
            firstName={profile?.first_name}
            lastName={profile?.last_name}
            size={150}
          />
        </div>
        <div className="profile-copy">
          <h1 className="ProfileName">{profile?.username}</h1>
          <p className="user-description">{profileDescription}</p>
        </div>
        <button
          className="profile-close-btn"
          onClick={handleClose}
          aria-label="Close profile"
        >
          ×
        </button>
      </div>
      <hr className="profile-divider" />

      <div className="profile-section">
        <h2 className="profile-divider-header">Photos</h2>
        <PolaroidCards photos={profile?.photos || []} />
      </div>

      <div className="profile-section">
        <h2 className="profile-divider-header">Clubs Joined</h2>
        <ClubMembershipPanel memberList={profile?.member_list || []} readOnly />
      </div>

      <div className="profile-section">
        <h2 className="profile-divider-header">Mutual Friends</h2>
        <MutualFriendsList friends={profile?.mutual_friends || []} viewerId={viewerId} />
      </div>
    </div>
  )
}

const MutualFriendsList = ({ friends, viewerId }) => {
  const navigate = useNavigate()

  if (!friends.length) {
    return <p className="friends-empty mutual-friends-empty">No mutual friends yet.</p>
  }

  return (
    <div className="friends-panel">
      <div className="friends-scroll">
        {friends.map((friend) => (
          <button
            type="button"
            className="friend-card friend-card-button"
            key={friend.id}
            onClick={() =>
              navigate(friend.id === viewerId ? '/profile' : `/friend/${friend.id}`)
            }
          >
            <Avatar
              url={friend.avatar_url}
              firstName={friend.first_name}
              lastName={friend.last_name}
              size={36}
            />
            <span className="friend-card-name">{friend.username}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default FriendProfile
