import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { UniSearchBar } from './UniSearchBar';
import IconBar from './IconBar';
import './UniversityPage.css';
import { ClubList } from './ClubList';
import { useClubData } from '../context/useClubData';

<link 
  href="https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,200..900;1,7..72,200..900&family=Raleway:ital,wght@1,100..900&display=swap" 
  rel="stylesheet"
/>;

export const UniversityPage = () => {
  const { id } = useParams();
  const [university, setUniversity] = useState(null);
  const [results, setResults] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);

  //grabs info we need for all club data
  const {allData, favoritesCache, setFavoritesCache, loading} = useClubData();

  useEffect(() => {
    console.log("favoritesCache changed:", favoritesCache);
  }, [favoritesCache]);

  useEffect(() => {
    if (allData.length > 0) {
      setResults(allData);
    }
  }, [allData]);

  const getClubsBasedOnCategory = async (newCategory) => {
    //if the user clicks the same icon again, then reset the clubs to display the default
    if (newCategory === selectedCategory) {
      setSelectedCategory(null);
      setResults(allData);
    }
    //special case if category is "favorites": depends on the user so must authenticate
    else if (newCategory === "favorites") {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        console.error('Error getting user', userError);
        return;
      }

      const userId = userData.user.id;

      // two cases: 
      // if favoritesCache is null, this indicates the user has added or subtracted a 
      // favorited club -> cache was invalidated, so trigger supabase request to refresh
      // cache
      // if favoritesCache is not null, then the cache is valid, so diplsay favoritesCache
      setSelectedCategory(newCategory);
      if (favoritesCache) {
        console.log("favoritesCache valid using cache.");
        setResults(favoritesCache);
      }
      //favoritesCache is null and therefore outdated -> request cache refresh
      else {
        console.log("favoritesCache invalid -> refreshing cache.");
        const { data, error } = await supabase
        .from('user_favorites')
        .select('*')
        .eq('user_id', userId);
        if (error) console.error(error);
        else {
          console.log(data);
          // since all the data is already stored in allData, we just filter from there
          const filteredData = allData.filter(club => data.some(fav => fav.club_id === club.id))
          setFavoritesCache(filteredData); //club is the rows from demo_club_data, fav is from user_favorites, final line checks to see where the two match (via id)
          setResults(filteredData);
          console.log("Refreshed cache: " + filteredData);
        }
      }
    }
    //if user selects different icon, then display corresponding information
    else {
      console.log("Other category selected");
      setSelectedCategory(newCategory); 
      const newdata = allData.filter(club => club.category === newCategory);
      setResults(newdata);
    }
  }
  
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

  if (loading || !university) return <div>Loading...</div>;

  return (
    <div className="UniPage">
     
    {/* 1. HERO VIDEO: The first thing they see */}
    <div style={{ width: '100%', height: '100vh', overflow: 'hidden', zIndex: 1000}}>
      <video 
        src={`/src/assets/intro_screen.mp4`} 
        autoPlay 
        
        muted 
        playsInline 
        style={{ 
          width: '100%', 
          height: '100%', 
          objectFit: 'cover' // Fills the screen without stretching
        }}
      />
    </div>
      <div className="fixed-wrapper">
  {/* Group 1: Left */}
  <div className="header-section left">
    <img className="flag" src="/src/assets/northeastern_flag.png" alt="flag" />
  </div>

  {/* Group 2: Center */}
  <div className="header-section center">
    <UniSearchBar setResults={setResults} university={university.uni_name} />
  </div>

  {/* Group 3: Right (This aligns with your global Login Icon) */}
  <div className="header-section right">
    <span className="signup-text">Sign Up</span>
    {/* The Login Icon from App.jsx will hover over/beside this area */}
    <div className="login-placeholder"></div> 
  </div>
</div>
      <IconBar onIconClick={getClubsBasedOnCategory} />
     <ClubList className="start" results={results} />
    </div>
  );
};

