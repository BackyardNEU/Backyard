import React, {useState, useEffect} from 'react'
import { apiFetch } from '../lib/api'
import { useClubData } from '../context/useClubData'
import {FaSearch, FaTh, FaThLarge} from 'react-icons/fa'
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

// Three densities, drawn as increasingly coarse grids so the control reads at a glance
// without needing labels.
const CARD_SIZE_OPTIONS = [
  { value: 'small', label: 'Small cards', glyph: <FaTh /> },
  { value: 'medium', label: 'Medium cards', glyph: <FaThLarge /> },
];

export const UniSearchBar = ({
  setResults,
  university,
  cardSize = 'medium',
  onCardSizeChange,
}) => {

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

  // The nav bar's Clubs and Calendar buttons clear the page's category filter,
  // but this control keeps its own copy of that selection to render the label.
  // Without this it goes on advertising a filter that is no longer applied —
  // pick "Service", press Clubs, and the full list comes back while the button
  // still reads "Service". Neither name is a real category, so nothing the
  // menu itself dispatches is caught here.
  useEffect(() => {
    const handler = (e) => {
      const category = e?.detail?.category;
      if (category === "clubs" || category === "calendar") setActiveCategory(null);
    };
    window.addEventListener("backyard-category-select", handler);
    return () => window.removeEventListener("backyard-category-select", handler);
  }, []);

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
    // No input: allData is already loaded by ClubDataProvider, so filter client-side
    // immediately rather than burning a round trip or making the user wait on a debounce.
    if (input.trim() === "") {
      const data = allData.filter((c) => c.school === university).slice(0, 100);
      setClubs(data);
      setResults(data);
      return;
    }

    let cancelled = false;

    // Debounce the search: wait 300ms after the user stops typing before querying.
    // This delay was previously 0, which defeated the debounce entirely — setTimeout(fn, 0)
    // fires on the next macrotask, before the cleanup below can cancel it, so every
    // keystroke issued its own /search request.
    const delayDebounceFn = setTimeout(async () => {
      try {
        const data = await apiFetch(
          `/search?q=${encodeURIComponent(input)}&school=${encodeURIComponent(university)}`,
          { auth: false }
        );
        // A newer query superseded this one while it was in flight; dropping the result
        // keeps a slow early response from overwriting fresher matches.
        if (cancelled) return;
        setClubs(data);
        setResults(data);
      } catch (err) {
        if (!cancelled) console.error("Error fetching clubs via search:", err);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(delayDebounceFn);
    };
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

        {/* Card density, in the spirit of the Xbox library's icon-size control. */}
        <div className="uni-size-toggle" role="radiogroup" aria-label="Club card size">
          {CARD_SIZE_OPTIONS.map(({ value, label, glyph }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={cardSize === value}
              aria-label={label}
              title={label}
              className={`uni-size-btn${cardSize === value ? ' active' : ''}`}
              onClick={() => onCardSizeChange?.(value)}
            >
              {glyph}
            </button>
          ))}
        </div>
    </div>
  )
}