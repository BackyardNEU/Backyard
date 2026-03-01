import React, {useState} from 'react'
import { useEffect } from 'react'
import { supabase } from '../supabase'

import {FaSearch} from 'react-icons/fa'
import './SearchBar.css'

export const SearchBar = ({ setResults }) => {

  const [input, setInput] = useState("")
  const [universities, setUniversities] = useState([]); // Initialized as an empty array.
  //hey, new comment

  useEffect(() => {
    console.log("useEffect running, input =", input);

    async function getUniversities() {

      let query = supabase.from("uni_names").select("*");

      if (input.trim() !== "") {
        query = query.ilike("uni_name", `%${input}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching universities:", error);
        return;
      }

      setUniversities(data);
      setResults(data);
    }

    getUniversities();
  }, [input, setResults]); //whenever the user input changes, we want to re-run this effect

  const handleChange = (value) => {
    setInput(value);
  }

  return (
    <div className="school-input-wrapper">
        <FaSearch className="search-icon" />
        <input
            placeholder="Search for your school"
            value={input}
            onChange={(e) => handleChange(e.target.value)}
        />
    </div>
  )
  
}