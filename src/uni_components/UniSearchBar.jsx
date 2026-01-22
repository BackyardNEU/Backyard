import React, {useState, useEffect} from 'react'
import { supabase } from '../supabase'
import {FaSearch} from 'react-icons/fa'
import './UniSearchBar.css'

export const UniSearchBar = ({ setResults, university}) => {

  const [input, setInput] = useState("")
  const [clubs, setClubs] = useState([]) 
  const [displayText, setDisplayText] = useState("")
  const [stopped, setStopped] = useState(false)


  const fullText = "Show me project based engineering clubs for beginners ";
useEffect(() => {
    // if user clicked → animation stops forever
    if (stopped) return;
    if (input.length > 0) return;

    // if user starts typing manually → stop animation
    

    let i = 0;
    let deleting = false;
    let pause = false;

    const interval = setInterval(() => {
      if (pause) return;

      if (!deleting) {
        setDisplayText(fullText.slice(0, i));
        i++;

        if (i === fullText.length) {
          pause = true;
          setTimeout(() => {
            pause = false;
            deleting = true;
          }, 800);
        }
      } else {
        setDisplayText(fullText.slice(0, i));
        i--;

        if (i < 0) {
          deleting = false;
          i = 0;
        }
      }
    }, 90);

    return () => clearInterval(interval);
  }, [input, stopped]);


  // --- CLICK stops animation + clears placeholder ---
  const handleClick = () => {
    if (!stopped) {
      setStopped(true);
      setDisplayText("");
    }
  };
   
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
            value={input.length ==0 ? displayText:input}
            onChange={(e) => setInput(e.target.value)}
        />
    </div>
  )
  
}