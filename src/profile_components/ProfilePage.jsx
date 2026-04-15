import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useGlobalStore } from '../store'
import './ProfilePage.css'
import imageCompression from 'browser-image-compression'
import { ClubMembershipPanel } from './ClubMembershipPanel'
import { FriendDiscoveryList } from './FriendDiscoveryList'


//this is the landing page for our university club search, most of the info will go through here

//at the moment, the user should have the ability to log out form the profile page.
//if the user logs out form this page, boot them from the page back to the home page.

export const ProfilePage = () => {
  const { id } = useParams()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [status, setStatus]     = useState('idle')
  const [preview, setPreview]   = useState(null)
  const [imageUrl, setImageUrl] = useState(null)
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

      // Fetch profile data (username/avatar) from your app table (e.g., `profiles`)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', authUser.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile data:', profileError);
        return;
      }

      setProfile(profileData);
    }

    loadUser();
  }, []);

  const navigate = useNavigate();
  const lastPath = useGlobalStore((state) => state.lastPath);

  useEffect(() => {
    const handleBack = (event) => {
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
        const fileName = `${user.id}.webp`

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(fileName, compressed, {
            upsert: true,
            contentType: 'image/webp',
          });
        
        if (uploadError) { throw uploadError}

        const { data } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(fileName)


        const {error: updateError} = await supabase
          .from(TABLE)
          .update({ [URL_COL]: data.publicUrl })
          .eq('id', user.id)

        if (updateError) { throw updateError }
        setProfile(prev => ({ ...prev, [URL_COL]: data.publicUrl }))
        setImageUrl(data.publicUrl)
        setStatus('success')
    }
    catch (error) {
      console.error('Error uploading avatar:', error);
      setStatus('error');
    }
  }
}

  return (
      <div className="ProfilePage">
        <div className='spacer' />
        <div className='profile-header'>
          <label htmlFor="avatar-upload" className="profile-photo-btn">
            <img
              src={preview || profile?.avatar_url}
              alt="Profile"
              className="profile-image"
            />
          </label>
          <input type="file" accept="image/*" id="avatar-upload" hidden onChange={handleAvatarUpload} />
          <h1 className='ProfileName'>Hello, {profile?.username}</h1>
          <button
            className="profile-close-btn"
            onClick={() => navigate(lastPath && lastPath !== '/profile' ? lastPath : '/')}
            aria-label="Close profile"
          >
            ×
          </button>
        </div>
        <hr className="profile-divider" />
        {user && (
          <>
            <div className="profile-section">
              <h2 className="profile-divider-header">Clubs</h2>
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
