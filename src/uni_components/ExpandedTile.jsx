import React, {useState} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import ReviewPage from "../review_components/ReviewPage";
import "./ExpandedTile.css";


function ExpandedTile({club, onClose}){
    const [isOpen, setIsOpen] = useState(false);
 
    const handleClick = () => {
    setIsOpen(!isOpen);
    }
    return (


        <motion.div
            layoutId = {`club-${club.id}`}
            className = "expanded-card"
           
        >
    
        <button className = "close-btn" onClick= {onClose}>x</button>
        
        <div className="content-col">
            <div className="content-row">
                <div className="text-flex">
                    <h2 className="club-name-exp">{club.club_name}</h2>
                    <h2 className="club-tag1">Web Dev • Introductory</h2>
                </div>
                    <div className = "rectangle">
                    <img className="club-img-exp" src={club.image_url} alt={club.club_name} />
                    </div>
                </div>
            
        </div>
        
        
        <div className ="club-tag2">
        <div className = "tag">Beginner</div>
        <div className = "tag">Hands On</div>
        <div className = "tag">Good Mentors</div>
        </div>
        <p className= "club-description-exp">{club.club_description}</p>
        <div className="content-col">
        <div className = "divider"></div>
        </div>
        <h3>Have you been in this club?</h3>
        <button className = "review-btn" onClick = {handleClick}>{isOpen ? 'Share your experience': 'Share your experience'}</button>
        {isOpen && (
            <div>
            <ReviewPage/>
            </div>)

        }
        
        
        
        


        </motion.div>

    );
}

export default ExpandedTile;

