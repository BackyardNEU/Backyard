import React, {useState} from 'react'
import { useEffect } from 'react'
import { useRef } from 'react';
import './IconBar.css'


export default function IconBar({ onIconClick }) {
    const icons = [
        { name: "heart", label: "Favorites", category: "favorites" },
        { name: "fsl", label: "FSL", category: "fsl" },
        { name: "soccer", label: "Intramurals", category: "intramural_sports" },
        { name: "art", label: "Visual Arts", category: "visual_arts" },
        { name: "robot", label: "Engineering", category: "engineering" },
        { name: "code", label: "Comp Sci", category: "programming" },
        { name: "tree", label: "Environment", category: "nature" },
        { name: "cross", label: "Medicine", category: "medicine"},
        { name: "calc", label: "Math", category: "math"},
        { name: "guitar", label: "Music", category: "music"},
        { name: "capitol", label: "Law", category: "law"},
    ];

    const [active, setActive] = useState(null);

    const handleClick = (category) => {
        setActive(category);

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