import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import "./ExpandedTile.css";


function ExpandedTile({club, onClose}){
    return (
    <AnimatePresence>

        <motion.div
            layoutId = {`club-${club.id}`}
            className = "expanded-card"
            initial = {{opacity: 0}}
            animate = {{opacity: 1}}
            exit = {{ opacity: 0}}

        >
        <div className="club-img-exp">🦝</div>
        <button className = "close-btn" onClick={onClose}>x</button>
        
        <h2 className ="club-name-exp">{club.club_name}</h2>
        <h2 className ="club-tag1">Web Dev • Introductory</h2>
        <div className ="club-tag2">
        <div className = "tag">Beginner</div>
        <div className = "tag">Hands On</div>
        <div className = "tag">Good Mentors</div>
        </div>
        <p className= "club-description-exp">{club.club_description}</p>

        <div className = "divider"></div>
        <h3>Have you been in this club?</h3>
        <Link to="/reviews/:id" className = "review-btn">Share your experience</Link>
        


        </motion.div>
    </AnimatePresence>
    );
}

export default ExpandedTile;

