import { supabase } from '../supabase';
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useGlobalStore } from "../store";

import "./ReviewPage.css"
import { ReviewList } from './ReviewList';

export default function ReviewPage({clubId}) {

    //current problem: I need to include all other spellings and cases of swears
    const badWords = [
        ' ass ', 'fuck', 'shit', 'bitch', 'whore', 'cunt', ' nigger', 'nigga', 'negro', 'chink', 'fag',
        ' a$$', ' a$s', 'as$', '@ss', 'sh1t', 'bltch', 'b1tch', 'wh0re', 'n1gger', 'nlgger', 'n1gga', 'nlgga', 'negr0', 'f@g', 'asshole', 'assh0le',
        'retard', 'pussy', 'ret@rd'
    ]
    const GlobalValue = useGlobalStore((state) => state.GlobalValue);
    const id  = clubId;
    console.log(id)
    const [reviews, set_reviews] = useState([]);
    const [warning, setWarning] = useState("")
    //user input variables
    const [ user_review , set_user_review ] = useState('');
    const [ rating , set_rating ] = useState(0);
    const [user_title, set_user_title] = useState('');
    const [user_tags, set_user_tags] = useState({"Beginner Friendly": false, "Advanced": false, "Friendly": false, "Supportive": false, 
                           "Good Networking": false,  "Flexible Attendance": false, "Strict Attendance": false, 
                           "Time Intensive": false, "Fun": false, "Boring": false, "Career Focused": false, "High Energy": false, 
                           "Tight-knit": false, "Poor Organization": false, "Collaborative": false, "Web Dev": false, 
                           "Fraternity": false, "Sorority": false})
    
    const [user_hours, set_user_hours] = useState(0)
    const [user_fun, set_user_fun] = useState(0)
    const [user_leadership, set_user_leadership] = useState(0)
    const [club, setClub] = useState(null);

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

    useEffect(() => {
    async function fetchClub() {
        const { data, error } = await supabase
            .from('demo_club_data')
            .select('*')
            .eq('id', id);
        
        if (error) {
            console.error('Error fetching club:', error);
            return;
        }
        
        if (data && data.length > 0) {
            setClub(data[0]);  // Get first item from array
        } else {
            console.log('No club found with id:', id);
        }
    }
    
    fetchClub();
}, [id]);

    //tags function

    const toggleTag = (tag) => {
        set_user_tags((prev) => {
        const selectedCount = Object.values(prev).filter(Boolean).length;
        
        if (!prev[tag] && selectedCount >3) {
            setWarning("Maximum 3 tags allowed");
            return prev;
        }
        
        return {
            ...prev,
            [tag]: !prev[tag], 
        };
    });
};
    
    async function post_review() {
        //gets user data
        const {
        data: { user }
        } = await supabase.auth.getUser();

        //first check if the user is logged in
        if (GlobalValue) {
            //then, once checked, check if either field is empty (or rating isn't a number between 0-5)
            if(user_review && user_title && Number.isInteger(Number(rating)) && rating >= 1 && rating <= 5) {
                //finally, take the values and post the review
                for(let i=0; i < badWords.length; i++) {
                    const regex = new RegExp(badWords[i], 'gi');
                    if(regex.test(user_review) || regex.test(user_title)){
                        setWarning("Review contains harmful content. Please do not use derogatory or harmful speech.");
                        return;
                    }
                }
                const { error } = await supabase
                    .from('reviews')
                    .insert({club_id: id, user_id: user.id, rating: rating, review_text: user_review, review_title: user_title, review_tags: user_tags })
                    .select()
                
                if (error) {
                console.error('Error fetching reviews:', error);
                return;
                }
            }    
        }
        else {
            console.log("please log in before you post a review")
        }
    }

    const selectedCount = Object.values(user_tags).filter(Boolean).length;
    return (
        <div className='review-page'>
            

            <div className='create-review'>
                <h1 className="instruction-txt">Leave a comment</h1>
                <div className = 'create-comment'>
               
                <input 
                    type="text"
                    value={user_title}
                    onChange={(e) => set_user_title(e.target.value)}
                    placeholder="Comment title"
                />
                <input 
                    type="text"
                    value={user_review}
                    onChange={(e) => set_user_review(e.target.value)}
                    placeholder={`Tell other people about you experience in ${club?.club_name || 'this club'}...`}
                />

                </div>
            
                <h1 className="instruction-txt">Choose Tags</h1>
                    
                
                {Object.entries(user_tags).map(([key, value]) => (
                    
                    <div key ={key} className = "tag-box">
                        <input 
                            id = {key}
                            type = "checkbox"
                            checked = {value}
                            onChange = {() => toggleTag(key)}
                            className = "tag-checkbox"
                            disabled={!value && selectedCount >= 3}
                        />
                        <label 
                            className={`tags ${!value && selectedCount >= 3 ? 'tag-disabled' : ''}`}
                            htmlFor={key}
                        >
                            {key}
                        </label>
                    </div> 
                ))}

                <h1 className="instruction-txt">Give Users more data</h1>
                
                <p>How many hours per week do you spend in this club?</p>
                <input className = "slider"
                    type="range" 
                    min="1" 
                    max="12"
                    step = "0.2"
                    value= {user_hours}
                    onChange={(e) => set_user_hours(Number(e.target.value))}
                />
                <p>How strong was the leadership /10?</p>
                <input className = "slider"
                    type="range" 
                    min="1" 
                    max="10"
                    step = "0.1"
                    value= {user_leadership}
                    onChange={(e) => set_user_leadership(Number(e.target.value))}
                />
                 <p>How fun was this club /10?</p>
                <input className = "slider"
                    type="range" 
                    min="1" 
                    max="10" 
                    value= {user_fun}
                    onChange={(e) => set_user_fun(Number(e.target.value))}
                />
                
                <button onClick={post_review} className="post">Post Review</button>
                <p>{warning}</p>
            </div>

            <p>this is where we'll see past reviews </p>
            <div className='view-reviews'>
                { 
                    reviews.map((review) => {
                        return <ReviewList review={review} key={review.club_id}/>
                    })
                }
            </div>
        </div>
    );

    }
