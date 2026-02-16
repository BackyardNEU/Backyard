import React, {useState, useEffect} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import ReviewPage from "../review_components/ReviewPage";
import "./ExpandedTile.css";
import ReviewList from "../review_components/ReviewList"; 
import { supabase } from '../supabase';

function ExpandedTile({club, onClose}){
    const [isOpen, setIsOpen] = useState(false);
    const [reviews, set_reviews] = useState([]);
    const id  = club.id;
 
    const handleClick = () => {
    setIsOpen(!isOpen);
    }

    useEffect(() => {
            async function fetch_reviews() {
                const {data, error} = await supabase
                    .from('reviews')
                    .select('*')
                    .eq('club_id', id);
    
                if (error) {
                    console.error('Error fetching reviews:', error);
                    return;
                }
                set_reviews(data);
            }
            fetch_reviews();
        }, [id])
    return (


        <motion.div
            layoutId = {`club-${club.id}`}
            className = "expanded-card"
           
        >
    
        <button className = "close-btn" onClick= {onClose}>x</button>
        
        
            <div className="content-col">
                <div className = "rectangle"></div>
                <div className="text-flex">
                    <h2 className="club-name-exp">{club.club_name}</h2>
                    <h2 className="club-tag1">Web Dev • Introductory</h2>
                </div>
                
                <div className ="image-stack">
                        <div className = "rectangle_min">
                        <img className="club-img-exp" src={club.image_url} alt={club.club_name}/>
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
        <p className = "divider-header">Stats</p>
        <div className='view-reviews'>
                        { 
                            reviews.map((review) => {
                                return <ReviewList review={review} key={review.club_id}/>
                            })
                        }
        </div>
        <h3>Have you been in this club?</h3>
        <button className = "review-btn" onClick = {handleClick}>{isOpen ? 'Share your experience': 'Share your experience'}</button>
        {isOpen && (
            <div>
            <ReviewPage clubId = {club.id}/>
            </div>)

        }
        
        
        
        


        </motion.div>

    );
}

export default ExpandedTile;

