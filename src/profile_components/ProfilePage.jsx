import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useGlobalStore } from '../store'
// import { Logout } from '../components/Logout'
import './ProfilePage.css'

//this is the landing page for our university club search, most of the info will go through here

//at the moment, the user should have the ability to log out form the profile page.
//if the user logs out form this page, boot them from the page back to the home page.

export const ProfilePage = () => {
  const { id } = useParams()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)

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
      
    }
  }

  return (
      <div className="ProfilePage">
        <div className='spacer' />
        <div className='profile-header'>
          <img
            src={
              profile?.avatar_url ||
              user?.user_metadata?.avatar_url ||
              user?.avatar_url ||
              "/raccoon_pfp.png"
            }
            alt="Profile"
            className="profile-image"
          />
          <input type="file" accept="image/*" id="avatar-upload" hidden onChange={handleAvatarUpload} />
          <button onClick={() => document.getElementById('avatar-upload').click()}>
            Change Photo
          </button>
          <h1 className='ProfileName'>{profile?.username || user?.email || "User"}</h1>
        </div>
        <h1 className='ProfileName'>Your Profile (currently being worked on)</h1>
      </div>
    )
}

export default ProfilePage
