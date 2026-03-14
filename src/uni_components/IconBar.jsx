import React, {useState} from 'react'
import { useEffect } from 'react'
import { useRef } from 'react';
import './IconBar.css'


export default function IconBar({ onIconClick }) {
    const icons = [
        { name: "heart", label: "Favorites", category: "favorites" },
        { name: "fsl", label: "FSL", category: "fsl" },
        { name: "soccer", label: "Intramurals", category: "intramural_sports" },
        { name: "people", label: "Affinity", category: "affiliation" },
         { name: "tree", label: "Environment", category: "nature" },
         {name: "books", label: "Literature", category: "lit" },
         { name: "code", label: "Comp Sci", category: "programming" },
         
        {name: "dancer", label: "Performing", category: "performing" },
        { name: "guitar", label: "Music", category: "music"},
        { name: "art", label: "Visual Arts", category: "visual_arts" },
       { name: "robot", label: "Engineering", category: "engineering" },
        {name: "beaker", label: "Science", category: "science"},
         {name: "help", label: "Resources", category: "resources"},
        {name: "briefcase", label: "Business", category: "business" },
        
        { name: "cross", label: "Medicine", category: "medicine"},
        { name: "calc", label: "Math", category: "math"},
        { name: "capitol", label: "Law", category: "law"},
         {name: "heart", label: "fun", category: "fun"},

    ];

    const [active, setActive] = useState(null);

    const handleClick = (category) => {
        if (active === category) {
            setActive(null);
        }
        else{
            setActive(category);
        }

        onIconClick(category);
    };

    return (
   
        <div className="icon-bar">
            {icons.map((icon) => (
                <div
                    key={icon.name}
                    className={`icon-container ${active === icon.category ? 'active' : ''}`}
                    onClick={() => handleClick(icon.category)}
                >
                    <img
                        src={'/src/assets/' + icon.name + '.png'}
                        alt={icon.name}
                        className="icon"
                    />
                    <span className="icon-label">{icon.label}</span>
                </div>
            ))}
        </div>
       
    );
}