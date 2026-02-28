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
        setTypingSpeed(50); // Faster deleting

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
    console.log("useEffect running, input =", input);

    async function getClubs() {
      let query = supabase.from("demo_club_data").select("*").eq("school", university).limit(100); //next filter by school depending on the page we're on
      console.log("Query before filters:", query);

      if (input.trim() !== "") {
        query = query.ilike("club_name", `%${input}%`);
        console.log("Filtering with ILIKE:", `%${input}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching clubs:", error);
        return;
      }

      setClubs(data);
      setResults(data);
    }

    getClubs();
  }, [input]); //whenever the user input changes, we want to re-run this effect


  return (
    <div className="club-input-wrapper">
        <FaSearch className="search-icon" />
        <input
            onClick={(handleClick)}
            type="text"
            value={input}
            placeholder ={input.length === 0 ? displayText : ""}
            onChange={(e) => setInput(e.target.value)}
        />
    </div>
  )
  
}