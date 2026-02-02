import { supabase } from '../supabase';
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useGlobalStore } from "../store";

import "./ReviewPage.css"
import { ReviewGrid } from './ReviewGrid';

export default function ReviewPage({}) {

    //current problem: I need to include all other spellings and cases of swears
    const badWords = [
        ' ass ', 'fuck', 'shit', 'bitch', 'whore', 'cunt', ' nigger', 'nigga', 'negro', 'chink', 'fag',
        ' a$$', ' a$s', 'as$', '@ss', 'sh1t', 'bltch', 'b1tch', 'wh0re', 'n1gger', 'nlgger', 'n1gga', 'nlgga', 'negr0', 'f@g', 'asshole', 'assh0le',
        'retard', 'pussy', 'ret@rd'
    ]
    const GlobalValue = useGlobalStore((state) => state.GlobalValue);
    const { id } = useParams();
    console.log(id)
    const [reviews, set_reviews] = useState([]);
    const [warning, setWarning] = useState("")
    
    //user input variables
    const [ user_review, set_user_review ] = useState('');
    const [user_title, set_user_title] = useState('')
    const [ rating , set_rating ] = useState(0)
    const [user_tags, set_user_tags] = useState({"Beginner Friendly": false, "Advanced": false, "Friendly": false, "Supportive": false, 
                           "Good Networking": false,  "Flexible Attendance": false, "Strict Attendance": false, 
                           "Time Intensive": false, "Fun": false, "Boring": false, "Career Focused": false, "High Energy": false, 
                           "Tight-knit": false, "Poor Organization": false, "Collaborative": false, "Web Dev": false, 
                           "Fraternity": false, "Sorority": false})


    useEffect(() => {
        async function fetch_reviews() {
            const {data, error} = await supabase
                .from('reviews')
                .select('*');
                //.eq('club_id', id);

            if (error) {
                console.error('Error fetching reviews:', error);
                return;
            }
            set_reviews(data);
        }
        fetch_reviews();
    }, [id])

    //tags function

    const toggleTag = (tag) => {
        set_user_tags((prev) => ({
            ...prev,
            [tag]: !prev[tag], 

            }));
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
                    if(regex.test(user_review) || regex.text(user_title)){
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


    return (
        <div className='review-page'>
            <p>this is the review page, write review on the top and see others on the bottom</p>

            <div className='create-review'>
                <h1>Leave a comment</h1>
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
                    placeholder="Tell other people about you experience in {club name}.."
                />

                </div>
                <h1>Choose Tags</h1>
                <div className = "tag-box">

                {Object.entries(user_tags).map(key => (
                <div key ={key}>
                    <input 
                        type = "checkbox"
                        checked = {user_tags[key]}
                        onChange = {() => set_user_tags(prev => ({...prev, [key]: !prev[key]}))}
                    />
                <label>{key}</label>
                </div>
                ))}



                </div>


                
                <input
                    type="number"
                    value={rating}
                    onChange={(e) => set_rating(e.target.value)}
                    placeholder="Rate club out of 5"
                />
                <button onClick={post_review}>Post Review</button>
                <p>{warning}</p>
            </div>

            <p>this is where we'll see past reviews </p>
            <div className='view-reviews'>
                { 
                    reviews.map((review) => {
                        return <ReviewGrid review={review} key={review.club_id}/>
                    })
                }
            </div>
        </div>
    );

}
