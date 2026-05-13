import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { UniSearchBar } from './UniSearchBar';
import './UniversityPage.css';
import { ClubList } from './ClubList';
import { useGlobalStore } from "../lib/store";
import { useClubData } from '../context/useClubData';
import { CalendarPage } from './CalendarPage';

// Import your images
import ghibliBackground from '/src/assets/ghibili_background.jpg';
import ghibliPlant from '/src/assets/ghibliPlant.png';
import headerLogo from '/src/assets/header_logo.png';
import neuFlag from '/src/assets/neu_flag.png';

export const UniversityPage = () => {
  const { id } = useParams();
  const [university, setUniversity] = useState(null);
  const [results, setResults] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  let GlobalValue = useGlobalStore((state) => state.GlobalValue);
  const [showCalendar, setShowCalendar] = useState(false);

  const { allData, favoritesCache } = useClubData();

  useEffect(() => {
    const html = document.documentElement;
    html.style.backgroundImage = `url(${ghibliBackground})`;
    html.style.backgroundSize = 'cover';
    html.style.backgroundPosition = 'center';
    html.style.backgroundAttachment = 'fixed';
    return () => {
      html.style.backgroundImage = '';
      html.style.backgroundSize = '';
      html.style.backgroundPosition = '';
      html.style.backgroundAttachment = '';
    };
  }, []);

  useEffect(() => {
    if (!selectedCategory) setResults(allData);
  }, [allData]);

  const getClubsBasedOnCategory = (newCategory) => {
    console.log("Category received from function: " + newCategory);
    
    if (newCategory === selectedCategory) {
      console.log("Same category clicked- defaulting");
      setShowCalendar(false);
      setSelectedCategory(null);
      setResults(allData);
    } else if (newCategory === "calendar") {
      if (showCalendar) {
        setShowCalendar(false);
        setSelectedCategory(null);
      } else {
        setShowCalendar(true);
        setSelectedCategory("calendar");
      }
      return;
    } else if (newCategory === "favorites") {
      console.log("If triggering");
      setShowCalendar(false);
      setSelectedCategory(newCategory);
      const newdata = allData.filter(club => favoritesCache?.has(club.id));
      setResults(newdata);
    } else {
      console.log("Else triggering");
      setShowCalendar(false);
      setSelectedCategory(newCategory);
      const newdata = allData.filter(club => club.category === newCategory);
      setResults(newdata);
    }
  }

  useEffect(() => {
    const handler = (e) => {
      const category = e?.detail?.category;
      if (!category) return;
      getClubsBasedOnCategory(category);
    };
    window.addEventListener("backyard-category-select", handler);
    return () => window.removeEventListener("backyard-category-select", handler);
  }, [selectedCategory, allData, showCalendar, favoritesCache]);
  
  useEffect(() => {
    async function fetchUniversity() {
      try {
        const data = await apiFetch(`/universities/${id}`, { auth: false });
        setUniversity(data);
      } catch (err) {
        console.error('Error fetching university:', err);
      }
    }

    fetchUniversity();
  }, [id]);

  if (!university) return <div>Loading...</div>;

  return (
    <div className="UniPage">
      <div className="uni-background-layer" />
      <img src={neuFlag} alt="" className="uni-neu-flag" />
      <img
        src={ghibliPlant}
        alt=""
        className="uni-plant-layer"
      />

      <div className="uni-layout">
        <header className="uni-header-spacer">
          <img src={headerLogo} alt="Backyard" className="uni-header-logo" />
        </header>

        <div className="uni-search-row">
          <div className="uni-search-shell">
            <UniSearchBar setResults={setResults} setShowCalendar={setShowCalendar} university={university.uni_name} />
          </div>
        </div>

        <main className="uni-club-stage">
          <div className="uni-club-viewport">
            {showCalendar ? <CalendarPage /> : <ClubList results={results} />}
          </div>
        </main>

        <div className="uni-icon-row" />
      </div>
    </div>
  );
};