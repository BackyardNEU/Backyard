import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { UniSearchBar } from './UniSearchBar';
import IconBar from './IconBar';
import './UniversityPage.css';
import { ClubList } from './ClubList';
<link 
  href="https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,200..900;1,7..72,200..900&family=Raleway:ital,wght@1,100..900&display=swap" 
  rel="stylesheet"
/>;

export const UniversityPage = () => {
  const { id } = useParams();
  const [university, setUniversity] = useState(null);
  const [results, setResults] = useState([]);
  const [favActive, setFavActive] = useState(false);
  const [isDocked, setIsDocked] = useState(false);


  const fetchFavorites = async () => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      console.error('Error getting user', userError);
      return;
    }
    const userId = userData.user.id;

    if(!favActive) {
      const { data, error } = await supabase
        .from('user_favorites')
        .select('*')
        .eq('user_id', userId);
      setFavActive(true)
      if (error) console.error(error);
      else setResults(data);
    }
    
    else{
      console.log("fav off")
      const { data, error } = await supabase
        .from('demo_club_data')
        .select('*')

      setFavActive(false)
      if (error) console.error(error);
      else setResults(data);
    }

  };

  useEffect(() => {
    async function fetchUniversity() {
      const { data, error } = await supabase
        .from('uni_names')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        console.error('Error fetching university:', error);
        return;
      }

      setUniversity(data);
    }

    fetchUniversity();
  }, [id]);

  if (!university) return <div>Loading...</div>;

  return (
    <div className="UniPage">
      <div className = "fixed-wrapper">
        <h1 className="raleway-uni">{university.uni_name}</h1>
        <IconBar onFavoritesClick={fetchFavorites} />
        <UniSearchBar setResults={setResults} university={university.uni_name} />
      </div>
     < ClubList className ="start" results={results} />
    </div>
  );
};

