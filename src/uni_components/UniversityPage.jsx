import React, { useEffect, useState, useCallback } from 'react';
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
  const [isDocked, setIsDocked] = useState(false);
  const [allData, setAllData] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  //potentially consider adding another variable that maintains the old dataset prior to clicking on favorites

  const fetchAllData = useCallback(async () => {
    const { data, error } = await supabase
        .from('demo_club_data')
        .select('*')
    
    if (error) console.error("Error retrieving initial data.", error);
    else setAllData(data);
    setResults(data);
    console.log("All data: " + allData);
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const getClubsBasedOnCategory = async (newCategory) => {
    console.log("Category recived from function: " + newCategory);
    //if the user clicks the same icon again, then reset the clubs to display the default
    //this case also uses the least memory
    if (newCategory === selectedCategory) {
      console.log("Else if triggering");
      setSelectedCategory(null);
      setResults(allData);
    }
    //special case if category is "favorites": depends on the user so must authenticate
    else if (newCategory === "favorites") {
      console.log("If triggering");
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        console.error('Error getting user', userError);
        return;
      }

      const userId = userData.user.id;

      //begin data search for favorites
      setSelectedCategory(newCategory);
      const { data, error } = await supabase
        .from('user_favorites')
        .select('*')
        .eq('user_id', userId);
      if (error) console.error(error);
      else {
        const newdata = allData.filter(club => data.some(fav => fav.club_id === club.id)); //club is the rows from demo_club_data, fav is from user_favorites, final line checks to see where the two match (via id)
        if (newdata.length > 18) {
          setResults(newdata);
        }
        else {
          setResults(newdata);
        }
      }
    }
    //if user selects different icon, then display corresponding information
    else {
      console.log("Else triggering");
      setSelectedCategory(newCategory); 
      const {data, error} = await supabase
        .from("demo_club_data")
        .select("category")
        .eq("category", newCategory);
      if (error) console.error("Error loading club category", error);
      else {
        const newdata = allData.filter(club => data.some(category => category.category === club.category));
        console.log("New data: " + newdata);
        if (newdata.length > 18) {
          setResults(newdata);
        }
        else {
          setResults(newdata);
        }
        console.log("Results: " + results);
      }
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
      
      <div className = "fixed-wrapper">
        <div className = "header">
        <h1 className="raleway-uni">{university.uni_name}</h1>
        </div>
        <IconBar onIconClick={getClubsBasedOnCategory} />
        <UniSearchBar setResults={setResults} university={university.uni_name} />
      </div>
     <ClubList className="start" results={results} />
    </div>
  );
};

