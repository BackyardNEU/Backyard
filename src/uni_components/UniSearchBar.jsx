import React, {useState, useEffect} from 'react'
import { supabase } from '../supabase'
import {FaSearch} from 'react-icons/fa'
import './UniSearchBar.css'

export const UniSearchBar = ({ setResults, university}) => {

  const [input, setInput] = useState("")
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
    }, 300);

    // Cleanup function clears the timeout if the input changes before 300ms
    return () => clearTimeout(delayDebounceFn);
  }, [input, university, setResults]);

  return (
    <div className="club-input-wrapper">
        <FaSearch className="search-icon" />
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
    </div>
  )
  
}