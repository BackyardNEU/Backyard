import React, {useState, useEffect} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import ReviewPage from "../review_components/ReviewPage";
import "./ExpandedTile.css";
import ReviewList from "../review_components/ReviewList"; 
import { supabase } from '../supabase';
import logImage from '/src/assets/logImage.png';

function ExpandedTile({club, onClose}){
    const [isOpen, setIsOpen] = useState(false);
    const [reviews, set_reviews] = useState([]);
    const [isClicked, setIsClicked] = useState(false);
    const [animating, setAnimating] = useState(false);
    const id  = club.id;
 
    const handleClick = () => {
   setIsOpen(!isOpen); 
    
    // 2. Trigger the "Image" state and the "Pop" animation
    setIsClicked(true);
    setAnimating(true);

    // 3. After the animation finishes (250ms), swap back to the button
    setTimeout(() => {
        setIsClicked(false);
        setAnimating(false);
    }, 250); 
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
        <div style = {{marginBottom: "30px"}}>
        <h3>Have you been in this club?</h3>
        <div>{isClicked ? ( <img src = {logImage} className = "log-btn" alt = "Clicked state" /> ) :( 
        <button className={`review-btn ${animating ? 'pop' : ''}`} onClick = {handleClick}>Share your experience</button> )}</div>
        </div>
        {isOpen && (
            <div>
            <ReviewPage clubId = {club.id}/>
            </div>)

        }
        
        
        
        


        </motion.div>

    );
}

export default ExpandedTile;

