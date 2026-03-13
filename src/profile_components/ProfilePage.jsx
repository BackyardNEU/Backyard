import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabase'
// import { Logout } from '../components/Logout'
import './ProfilePage.css'

//this is the landing page for our university club search, most of the info will go through here

//at the moment, the user should have the ability to log out form the profile page.
//if the user logs out form this page, boot them from the page back to the home page.

export const ProfilePage = () => {
  const { id } = useParams()
  const [reviews, setReviews] = useState(null)
  const user = supabase.auth.getUser();
  const userId = user?.id;

  //this'll be used for the second table when we're ready
  useEffect(() => { 
    async function fetchReviews() {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('user_id', userId)

      if (error) {
        console.error('Error fetching reviews:', error)
        return
      }

      setReviews(data)
    }

    fetchReviews()
  }, [id])

  return (
      <div className="ProfilePage">
        <div className='spacer' />
        <h1 className='ProfileName'>Your Profile</h1>
      </div>
    )
}

export default ProfilePage