import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { UniSearchBar } from './UniSearchBar';
import IconBar from './IconBar';
import './UniversityPage.css';
import { ClubList } from './ClubList';
import { useGlobalStore } from "../store";
import Logout from '../login_components/Logout';
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
  let GlobalValue = useGlobalStore((state) => state.GlobalValue);
  const { allData, favoritesCache } = useClubData();

  useEffect(() => {
    if (!selectedCategory) setResults(allData);
  }, [allData]);

  const getClubsBasedOnCategory = (newCategory) => {
    console.log("Category recived from function: " + newCategory);
    //if the user clicks the same icon again, then reset the clubs to display the default
    //this case also uses the least memory
    if (newCategory === selectedCategory) {
      console.log("Else if triggering");
      setSelectedCategory(null);
      setResults(allData);
    }
    //special case if category is "favorites": use cached favorites
    else if (newCategory === "favorites") {
      console.log("If triggering");
      setSelectedCategory(newCategory);
      const newdata = allData.filter(club => favoritesCache?.has(club.id));
      setResults(newdata);
    }
    //if user selects different icon, then display corresponding information
    else {
      console.log("Else triggering");
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

  if (!university) return <div>Loading...</div>;

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
  <div
      className="content-with-background"
  >
  <div className = "community-board">
  {/*<div className = "community-board"*/}
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
    {/*<span className="signup-text">Sign Up</span>*/}
    {/* The Login Icon from App.jsx will hover over/beside this area */}
    <div className="login-placeholder"></div> 
  </div>
</div>
    
    
     <ClubList className="start" results={results} />
    </div>
      <IconBar onIconClick={getClubsBasedOnCategory} />
  </div>

  </div>
  );
};

