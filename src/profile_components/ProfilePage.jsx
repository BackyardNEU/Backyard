import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import './ProfilePage.css'

//this is the landing page for our university club search, most of the info will go through here 
export const ProfilePAge = () => {
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
        <h1 className='ProfileName'>Your Reviews</h1>
        <div id="iconBox"></div>
      </div>
    )
}