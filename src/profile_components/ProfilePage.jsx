import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'
import { useGlobalStore } from '../lib/store'
import './ProfilePage.css'
import imageCompression from 'browser-image-compression'
import { ClubMembershipPanel } from './ClubMembershipPanel'
import { FriendDiscoveryList } from './FriendDiscoveryList'
import { PolaroidCards } from './PolaroidCards'
import { InterestsModal } from './InterestsModal'
import Avatar from '../components/Avatar'
import { useClubData } from '../context/useClubData'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { Skeleton, SkeletonCircle, SkeletonRegion } from '../components/Skeleton'
import Logout from '../login_components/Logout'
import { NotificationBell } from '../notifications/NotificationBell'
import { DEFAULT_UNIVERSITY_PATH } from '../lib/university'

//this is the landing page for our university club search, most of the info will go through here

//at the moment, the user should have the ability to log out form the profile page.
//if the user logs out form this page, boot them from the page back to the home page.

export const ProfilePage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null)
  // Shared profile — this component used to fetch /me/profile itself, one of several
  // copies of the same request.
  const { profile, setProfile, loading } = useClubData()
  useDocumentTitle('Backyard | Profile')
  // These two were written as `const setStatus = useState('idle')`, which binds the whole
  // [value, setter] tuple to the name — so calling setStatus('compressing') called an
  // array and threw, killing avatar upload from this page before it started. Neither
  // value is rendered, so the value half stays discarded.
  const [, setStatus] = useState('idle')
  const [preview, setPreview]   = useState(null)
  const [, setImageUrl] = useState(null)
  //const inputRef = useRef(null)

  const BUCKET = 'profile_images'
  const TABLE  = 'profiles'
  const URL_COL = 'avatar_url'

  const COMPRESSION_OPTIONS = {
    maxSizeMB: 0.2,
    maxWidthOrHeight: 400,
    useWebWorker: true,
    fileType: 'image/webp',
  }

  useEffect(() => {
    async function loadUser() {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error('Error fetching user:', error);
        return;
      }

      const authUser = data?.user;
      setUser(authUser);

      if (!authUser) return;

      // Profile itself comes from ClubDataProvider, which already loaded it — this
      // component only needs to know whether anyone is signed in.
    }

    loadUser();
  }, [navigate]);

  const [interestsOpen, setInterestsOpen] = useState(false);

  const lastPath = useGlobalStore((state) => state.lastPath);

  useEffect(() => {
    const handleBack = () => {
      // When users hit the browser back button on the profile page,
      // send them back to where they were right before logging in.
      if (lastPath && lastPath !== window.location.pathname) {
        navigate(lastPath, { replace: true });
      }
    };

    window.addEventListener('popstate', handleBack);
    return () => window.removeEventListener('popstate', handleBack);
  }, [lastPath, navigate]);

  async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return; //eventually add error checker to see if file is an image and not too big
    else {
      setPreview(URL.createObjectURL(file))
      //compresses the image
      try {
        setStatus('compressing')
        const compressed = await imageCompression(file, COMPRESSION_OPTIONS)

        setStatus('uploading')

        // Two-step signed upload: backend picks the path (always `<userId>.webp` for
        // avatars, so re-uploads overwrite the previous file) and returns a signed PUT
        // URL plus the public URL we'll save in the profile row.
        const { signedUrl, publicUrl } = await apiFetch('/storage/profile-upload-url', {
          method: 'POST',
        });

        const putRes = await fetch(signedUrl, {
          method: 'PUT',
          body: compressed,
          headers: { 'Content-Type': 'image/webp' },
        });
        if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

        const verification = await apiFetch('/storage/verify-image', {
          method: 'POST',
          body: { publicUrl },
        });
        if (!verification.ok) {
          throw new Error(verification.error || 'Avatar rejected by content policy');
        }

        await apiFetch('/me/profile', {
          method: 'PUT',
          body: { [URL_COL]: publicUrl },
        });

        setProfile({ [URL_COL]: publicUrl })
        setImageUrl(publicUrl)
        setStatus('success')
    }
    catch (error) {
      console.error('Error uploading avatar:', error);
      setStatus('error');
    }
  }
}

  const profileDescription = profile?.biography ?? ''

  if (loading) {
    return (
      <SkeletonRegion className="ProfilePage" label="Loading your profile">
        <div className='spacer' />
        <div className='profile-header'>
          <SkeletonCircle size={140} />
          <div className="profile-copy">
            <Skeleton width="240px" height="2.2rem" />
            <Skeleton width="70%" height="1rem" style={{ marginTop: 10 }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <Skeleton width="130px" height="2.1rem" radius={999} />
              <Skeleton width="100px" height="2.1rem" radius={999} />
            </div>
          </div>
        </div>
        <hr className="profile-divider" />
        <div className="profile-section">
          <Skeleton width="180px" height="1.4rem" />
        </div>
      </SkeletonRegion>
    )
  }

  return (
      <div className="ProfilePage">
        {interestsOpen && <InterestsModal onClose={() => setInterestsOpen(false)} />}
        <div className='spacer' />
        <div className='profile-header'>
          <label htmlFor="avatar-upload" className="profile-photo-btn">
            {/* Had no fallback at all: with no avatar_url the src was undefined, React
                dropped the attribute, and the browser rendered a broken image — which
                collapsed to almost nothing and dragged the whole header out of place.
                Avatar shows initials instead. */}
            <Avatar
              url={preview || profile?.avatar_url}
              firstName={profile?.first_name}
              lastName={profile?.last_name}
              username={profile?.username}
              className="profile-image"
              alt="Your profile photo"
            />
          </label>
          <input type="file" accept="image/*" id="avatar-upload" hidden onChange={handleAvatarUpload} />
          <div className="profile-copy">
            <h1 className='ProfileName'>Hello, {profile?.username}</h1>
            <p className="user-description">{profileDescription}</p>
            <div className="profile-btn-row">
              <button
                type="button"
                className="profile-setup-btn"
                onClick={() => navigate('/profile-setup')}
              >
                Setup profile
              </button>
              <button
                type="button"
                className="profile-setup-btn"
                onClick={() => setInterestsOpen(true)}
              >
                My Interests
              </button>
              <button
                type="button"
                className="profile-setup-btn"
                onClick={() => navigate('/settings')}
              >
                Settings
              </button>
              {user && (
                <div className="profile-account-actions">
                  <NotificationBell />
                  <Logout />
                </div>
              )}
            </div>
          </div>
          <button
            className="profile-close-btn"
            onClick={() => navigate(DEFAULT_UNIVERSITY_PATH)}
            aria-label="Close profile"
          >
            ×
          </button>
        </div>
        <hr className="profile-divider" />
        {user && (
          <>
            <div className="profile-section">
               <div className="profile-section">
              <h2 className="profile-divider-header">Your Photos</h2>
              <PolaroidCards photos={profile?.photos || []} />
            </div>
              <h2 className="profile-divider-header">Clubs You've Joined</h2>
              <ClubMembershipPanel userId={user.id} />
            </div>
           
            <div className="profile-section">
              <h2 className="profile-divider-header">Friends</h2>
              <FriendDiscoveryList userId={user.id} />
            </div>
          </>
        )}
      </div>
    )
  }

export default ProfilePage
