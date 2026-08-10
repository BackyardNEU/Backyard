import React, {useState, useEffect} from 'react'
import { apiFetch } from '../lib/api'
import { useClubData } from '../context/useClubData'
import {FaSearch, FaCalendarAlt} from 'react-icons/fa'
import './UniSearchBar.css'

const CATEGORIES = [
  { label: "Favorites",            category: "favorites" },
  { label: "Arts",                 category: "arts" },
  { label: "Culture & Identity",   category: "culture_identity" },
  { label: "Spiritual Life",       category: "spiritual_life" },
  { label: "Greek Life",           category: "greek_life" },
  { label: "Intramural Sports",    category: "intramural_sports" },
  { label: "Service & Community",  category: "service_community" },
  { label: "Academics",            category: "academics" },
  { label: "Law & Politics",       category: "law_politics" },
  { label: "Professional Dev",     category: "professional_dev" },
  { label: "Technology",           category: "technology" },
  { label: "Engineering",          category: "engineering" },
  { label: "Science",              category: "science" },
  { label: "Math",                 category: "math" },
  { label: "Business",             category: "business" },
  { label: "Health",               category: "health" },
  { label: "Public Information",   category: "public_information" },
  { label: "Interests & Hobbies",  category: "interests_hobbies" },
];

export const UniSearchBar = ({ setResults, university, calendarActive = false }) => {

  const [input, setInput] = useState("")
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState(null)
  const [clubs, setClubs] = useState([])
  const [displayText, setDisplayText] = useState("")
  const { allData } = useClubData()
  

  const [typingSpeed, setTypingSpeed] = useState(100)
  const [isDeleting, setIsDeleting] = useState(false)
  const [phraseIndex, setPhraseIndex] = useState(0)

  const [isInteracted, setIsInteracted] = useState(false);

  const examplePhrases = ["Show me project based engineering clubs for beginners ", 
                    "Show me dance clubs for affinity groups", 
                    "Show me gaming clubs", 
                    "Show me clubs for foodies"
                  ];
  

  const handleCategorySelect = (category) => {
    setActiveCategory(prev => prev === category ? null : category);
    window.dispatchEvent(
      new CustomEvent("backyard-category-select", { detail: { category } })
    );
    setMenuOpen(false);
  };

  const handleCalendarClick = () => {
    setActiveCategory(null);
    window.dispatchEvent(
      new CustomEvent("backyard-category-select", { detail: { category: "calendar" } })
    );
  };

  const handleClick = () => {
    setIsInteracted(true);
};
useEffect(() => {
    // if user clicked → animation stops 
    if (input.length > 0 || isInteracted){
        setDisplayText("");
      return;
    }

    const handleTyping = () => {
      const currentPhrase = examplePhrases[phraseIndex];
      
      if (!isDeleting) {
        setDisplayText(currentPhrase.substring(0, displayText.length + 1));
        setTypingSpeed(100);

        if (displayText === currentPhrase) {
          setTypingSpeed(2000);
          setIsDeleting(true);
        }
      } else {
        // Deleting: remove one character
        setDisplayText(currentPhrase.substring(0, displayText.length - 1));
        setTypingSpeed(40); // Faster deleting

        // If phrase is fully deleted
        if (displayText === "") {
          setIsDeleting(false);
          setPhraseIndex((prev) => (prev + 1) % examplePhrases.length); // Move to next phrase
        }
      }
    };

    const timer = setTimeout(handleTyping, typingSpeed);
    return () => clearTimeout(timer);
  }, [displayText, isInteracted, isDeleting, phraseIndex, input]);
  
   
    useEffect(() => {
    async function getClubs() {
      if (input.trim() !== "") {
        // Full Text Search + Exact Match via the backend search route
        try {
          const data = await apiFetch(
            `/search?q=${encodeURIComponent(input)}&school=${encodeURIComponent(university)}`,
            { auth: false }
          );
          console.log("NL result sample:", data[0]);
          setClubs(data);
          setResults(data);
        } catch (err) {
          console.error("Error fetching clubs via search:", err);
        }
      } else {
        // Default state: no input. allData is already loaded by ClubDataProvider, so we
        // just filter it client-side rather than burn a second round trip.
        const data = allData.filter((c) => c.school === university).slice(0, 100);
        setClubs(data);
        setResults(data);
      }
    }

    // Debounce the search: wait 300ms after the user stops typing before querying
    const delayDebounceFn = setTimeout(() => {
      getClubs();
    }, 0);

    // Cleanup function clears the timeout if the input changes before 300ms
    return () => clearTimeout(delayDebounceFn);
  }, [input, university, setResults, allData]);

  return (
    <div className="club-input-wrapper">
      <icon className="search-icon"><FaSearch /></icon>

        <div className="input-container">

            {/* The Custom Placeholder that shrink-wraps the text */}
            {input.length === 0 && !isInteracted && (
                <span className="typewriter-placeholder">
                    {displayText}
                </span>
            )}


        <input

            onClick={(handleClick)}
            type="text"
            value={input}


            onChange={(e) => setInput(e.target.value)}
        />
    </div>

        <div className="hamburger-wrapper">
          <button
            className={`uni-hamburger-btn ${activeCategory ? 'active' : ''}`}
            type="button"
            onClick={() => setMenuOpen(prev => !prev)}
            aria-label="Open club categories"
          >
            {activeCategory
              ? CATEGORIES.find(c => c.category === activeCategory)?.label
              : "Categories"}
          </button>
          {menuOpen && (
            <div className="uni-hamburger-dropdown">
              {CATEGORIES.map(({ label, category }) => (
                <button
                  key={category}
                  type="button"
                  className="uni-hamburger-item"
                  onClick={() => handleCategorySelect(category)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          className={`uni-calendar-btn${calendarActive ? ' active' : ''}`}
          type="button"
          onClick={handleCalendarClick}
          aria-label="View events calendar"
        >
          <FaCalendarAlt />
        </button>
    </div>
  )
}