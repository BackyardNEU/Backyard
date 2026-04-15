import React, {useState, useEffect} from 'react'
import { supabase } from '../supabase'
import {FaSearch} from 'react-icons/fa'
import './UniSearchBar.css'

const CATEGORIES = [
  { label: "Calendar", category: "calendar" },
  { label: "Favorites", category: "favorites" },
  { label: "FSL", category: "fsl" },
  { label: "Intramurals", category: "intramural_sports" },
  { label: "Affinity", category: "affiliation" },
  { label: "Environment", category: "nature" },
  { label: "Literature", category: "lit" },
  { label: "Comp Sci", category: "programming" },
  { label: "Performing", category: "performing" },
  { label: "Music", category: "music" },
  { label: "Visual Arts", category: "visual_arts" },
  { label: "Engineering", category: "engineering" },
  { label: "Science", category: "science" },
  { label: "Resources", category: "resources" },
  { label: "Business", category: "business" },
  { label: "Medicine", category: "medicine" },
  { label: "Math", category: "math" },
  { label: "Law", category: "law" },
  { label: "Fun", category: "fun" },
];

export const UniSearchBar = ({ setResults, university}) => {

  const [input, setInput] = useState("")
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState(null)
  const [clubs, setClubs] = useState([]) 
  const [displayText, setDisplayText] = useState("")
  

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
        // Typing: add one character
        setDisplayText(currentPhrase.substring(0, displayText.length + 1));
        setTypingSpeed(100); // Normal typing speed

        // If phrase is complete
        if (displayText === currentPhrase) {
          setTypingSpeed(2000); // Pause at the end
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
        // Full Text Search + Exact Match using our PostgreSQL RPC
        const { data, error } = await supabase.rpc("search_clubs", {
          search_query: input,
          filter_school: university,
        });

        console.log("NL result sample:", data[0])

        

        if (error) {
          console.error("Error fetching clubs via RPC:", error);
          return;
        }

        setClubs(data);
        setResults(data);
      } else {
        // Default state: no input, fetch basic club list for the school
        const { data, error } = await supabase
          .from("demo_club_data")
          .select("*")
          .eq("school", university)
          .limit(100);

        if (error) {
          console.error("Error fetching default clubs:", error);
          return;
        }

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
  }, [input, university, setResults]);

  return (
    <div className="club-input-wrapper">
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
            placeholder='Ask Rac'
            
            onChange={(e) => setInput(e.target.value)}
        />
    </div>
    </div>
  )
  
}