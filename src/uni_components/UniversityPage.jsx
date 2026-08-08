import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { isUuid, slugifyUniversity, slugMatches } from '../../shared/slug';
import { UniSearchBar } from './UniSearchBar';
import './UniversityPage.css';
import { ClubList } from './ClubList';
import { CalendarPage } from './CalendarPage';
import { useGlobalStore } from "../lib/store";
import { useClubData } from '../context/useClubData';

// Import your images
import ghibliBackground from '/src/assets/ghibili_background.jpg';
import ghibliPlant from '/src/assets/ghibliPlant.png';
import headerLogo from '/src/assets/header_logo.png';
import neuFlag from '/src/assets/neu_flag.png';
import borderImg from '/src/assets/border.svg';
import borderHorizontalImg from '/src/assets/border-horizontal.svg';

// Matches the <title> in index.html, so leaving this page restores it rather than
// stranding the browser tab on whichever school was open last.
const DEFAULT_TITLE = "Welcome to your school's Backyard!";

export const UniversityPage = () => {
  // Either a slug ("Northeastern") or a UUID — the API resolves both, and old UUID links
  // are rewritten to the slug once the name is known.
  const { id } = useParams();
  const navigate = useNavigate();
  const [university, setUniversity] = useState(null);
  const [results, setResults] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  let GlobalValue = useGlobalStore((state) => state.GlobalValue);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMounted, setCalendarMounted] = useState(false);

  const { allData, favoritesCache } = useClubData();

  useEffect(() => {
    if (showCalendar) setCalendarMounted(true);
  }, [showCalendar]);

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
    let cancelled = false;

    async function fetchUniversity() {
      try {
        const data = await apiFetch(`/universities/${id}`, { auth: false });
        if (!cancelled) setUniversity(data);
        return;
      } catch (err) {
        // A backend that predates slug support only accepts a UUID here and rejects a
        // slug outright ("invalid input syntax for type uuid"). Fall back to the list
        // endpoint, which every version of the API serves, and resolve it client-side
        // with the same shared slug logic the server uses.
        //
        // Keeps the app working against a Railway deploy that is behind this branch,
        // and costs one extra request only on that path.
        if (isUuid(id)) {
          if (!cancelled) console.error('Error fetching university:', err);
          return;
        }
      }

      try {
        const all = await apiFetch('/universities', { auth: false });
        const match = (all || []).find((u) => slugMatches(id, u.uni_name));
        if (cancelled) return;
        if (match) setUniversity(match);
        else console.error(`No university matches the slug "${id}"`);
      } catch (err) {
        if (!cancelled) console.error('Error fetching university:', err);
      }
    }

    fetchUniversity();
    return () => { cancelled = true; };
  }, [id]);

  // Tab title. Restored on unmount so other routes do not inherit it.
  useEffect(() => {
    if (!university?.uni_name) return;
    document.title = `Backyard | ${university.uni_name}`;
    return () => { document.title = DEFAULT_TITLE; };
  }, [university]);

  // Rewrite a legacy UUID URL to the readable slug once the name resolves. `replace` so
  // it does not add a history entry the back button has to step through.
  useEffect(() => {
    if (!university?.uni_name || !isUuid(id)) return;
    const slug = university.slug || slugifyUniversity(university.uni_name);
    navigate(`/university/${slug}`, { replace: true });
  }, [university, id, navigate]);

  if (!university) return <div>Loading...</div>;

  return (
    <div className="UniPage">
      <div className="uni-background-layer" />
      <img
        src={ghibliPlant}
        alt=""
        className="uni-plant-layer"
      />

      <div className="uni-layout">
        <header className="uni-header-spacer">
          <img src={neuFlag} alt="" className="uni-neu-flag" />
          <img src={headerLogo} alt="Backyard" className="uni-header-logo" />
        </header>

        <div className={`uni-search-row${showCalendar ? ' uni-fade-hidden' : ''}`}>
          <div className="uni-search-shell">
            <UniSearchBar setResults={setResults} university={university.uni_name} calendarActive={showCalendar} />
          </div>
        </div>

        <main className={`uni-club-stage${showCalendar ? ' uni-fade-hidden' : ''}`}>
          <div className="uni-club-viewport">
            <ClubList results={results} />
          </div>
        </main>

        {calendarMounted && (
          <div
            className={`uni-calendar-inline${showCalendar ? ' uni-calendar-visible' : ''}`}
            onTransitionEnd={(e) => {
              if (e.propertyName === 'opacity' && !showCalendar) setCalendarMounted(false);
            }}
          >
            <img src={borderImg} alt="" className="uni-calendar-border uni-calendar-border-left" />
            <img src={borderImg} alt="" className="uni-calendar-border uni-calendar-border-right" />
            <div
              className="uni-calendar-border-h-wrap uni-calendar-border-top-wrap"
              style={{ backgroundImage: `url(${borderHorizontalImg})` }}
              aria-hidden="true"
            />
            <div
              className="uni-calendar-border-h-wrap uni-calendar-border-bottom-wrap"
              style={{ backgroundImage: `url(${borderHorizontalImg})` }}
              aria-hidden="true"
            />
            <CalendarPage onClose={() => { setShowCalendar(false); setSelectedCategory(null); }} />
          </div>
        )}
      </div>
    </div>
  );
};