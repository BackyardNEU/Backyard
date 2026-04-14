import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { FaGraduationCap, FaSearch } from 'react-icons/fa'
import './SearchBar.css'

export const SearchBar = () => {
  const [input, setInput] = useState("")
  const [allUniversities, setAllUniversities] = useState([])
  const [filtered, setFiltered] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const navigate = useNavigate()
  const inputRef = useRef(null)

  // Load all universities once — enables instant client-side filtering
  useEffect(() => {
    supabase.from("uni_names").select("*").then(({ data, error }) => {
      if (!error && data) setAllUniversities(data);
    });
  }, []);

  // Filter client-side as user types
  useEffect(() => {
    if (input.trim()) {
      setFiltered(allUniversities.filter(u =>
        u.uni_name.toLowerCase().includes(input.toLowerCase())
      ));
    } else {
      setFiltered(allUniversities);
    }
    setActiveIndex(-1);
  }, [input, allUniversities]);

  const handleKeyDown = (e) => {
    if (!showDropdown || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      const target = filtered[activeIndex >= 0 ? activeIndex : 0];
      if (target) { navigate(`/university/${target.id}`); close(); }
    } else if (e.key === "Escape") {
      close();
    }
  };

  const handleSelect = (id) => {
    navigate(`/university/${id}`);
    close();
  };

  const close = () => {
    setShowDropdown(false);
    setInput("");
    setActiveIndex(-1);
  };

  // Highlight the typed portion — typed text normal, rest bold (Google style)
  const highlight = (text) => {
    if (!input.trim()) return <span>{text}</span>;
    const idx = text.toLowerCase().indexOf(input.toLowerCase());
    if (idx === -1) return <span>{text}</span>;
    return (
      <>
        {text.slice(0, idx)}
        <span className="match-typed">{text.slice(idx, idx + input.length)}</span>
        <strong>{text.slice(idx + input.length)}</strong>
      </>
    );
  };

  const open = showDropdown && filtered.length > 0;

  return (
    <div className={`school-input-wrapper${open ? ' school-input-wrapper--open' : ''}`}>
      <FaGraduationCap
        className="hat-icon"
        onClick={() => { setShowDropdown(prev => !prev); inputRef.current?.focus(); }}
      />
      <FaSearch className="search-icon" />
      <input
        ref={inputRef}
        placeholder="Search for your school"
        value={input}
        onChange={(e) => { setInput(e.target.value); setShowDropdown(true); }}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (input || filtered.length) setShowDropdown(true); }}
        onBlur={() => setTimeout(close, 150)}
      />

      {open && (
        <div className="school-dropdown">
          {filtered.map((u, i) => (
            <div
              key={u.id}
              className={`school-dropdown-item${i === activeIndex ? ' school-dropdown-item--active' : ''}`}
              onMouseDown={() => handleSelect(u.id)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <FaSearch className="suggestion-icon" />
              {highlight(u.uni_name)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
