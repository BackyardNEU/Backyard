import { supabase } from '../supabase';
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useGlobalStore } from "../store";
import thanksImage from "../assets/thanks.png"

import "./ReviewPage.css"
import ReviewList from "../review_components/ReviewList"; 

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
    const [user_community, set_user_community] = useState(0)
    const [user_growth, set_user_growth] = useState(0)
    const [club, setClub] = useState(null);
    const [username, setUsername] = useState("");

    
        const [file, setFile] = useState(null);
        const [uploading, setUploading] = useState(false);
        const [fileUrl, setFileUrl] = useState("");

        const handleFileChange = event => {
            setFile(event.target.files[0]);
        };

        const handleUpload = async () => {
            try {
             setUploading(true);

             if (!file) {
                console.log("Please select a file to upload.")
                return;
             }

             const fileExt = file.name.split(".").pop();
             const fileName = `${Math.random()}.${fileExt}`
             const filePath = `${fileName}`;

            let { data, error } = await supabase.storage
                .from('review_images')
                .upload(filePath, file);

            if (error) {
                throw error;
            }

            const {data: url} = await supabase.storage
            .from("review_images")
            .getPublicUrl(filePath);
            
            setFileUrl(url.publicUrl);
            alert("File uploaded successfully.");

        } catch (error) {
                alert("Error uploading file:" , error.message)

            }
        finally{
            setUploading(false);
        }

       
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

    useEffect(() => {
    async function fetchClub() {

        const {
        data: { user }
        } = await supabase.auth.getUser();

        setUsername(user?.user_metadata?.full_name || user?.email || "User");
        
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
    const fill = (backgroundColor, start, end, value) => {
        const percentage = ((value- start)/ (end-start)) * 100
        return `linear-gradient(to right, ${backgroundColor} ${percentage}%, #ffffffff ${percentage}%)`

    };
    
    async function post_review() {
        console.log("posting review")
        //gets user data
        const {
        data: { user }
        } = await supabase.auth.getUser();

        //first check if the user is logged in
        if (GlobalValue) {
            //then, once checked, check if either field is empty (or rating isn't a number between 0-5)
            if(user_review && user_title) {
                //finally, take the values and post the review
                for(let i=0; i < badWords.length; i++) {
                    const regex = new RegExp(badWords[i], 'gi');
                    if(regex.test(user_review) || regex.test(user_title)){
                        setWarning("Review contains harmful content. Please do not use derogatory or harmful speech.");
                        return;
                    }
                }
                
                const selectedTags = Object.entries(user_tags)
                  .filter(([, v]) => v)
                  .map(([k]) => k);

                const { error } = await supabase
                    .from('reviews')
                    .insert({club_id: id, user_id: user.id, review_text: user_review, review_title: user_title, review_tags: selectedTags, club_hours: user_hours, club_leadership: user_leadership, club_fun: user_fun, club_community: user_community, club_growth_index: user_growth, review_image: fileUrl})
                    .select()
                
                if (error) {
                    console.error('Error fetching reviews:', error);
                    setWarning(error.message || 'Failed to post review');
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

                <input
                    type = "file"
                    accept="image/*" 
                    capture="environment"
                    onChange = {handleFileChange}
                    />
                <button onClick = {handleUpload} disabled={uploading}>
                    {uploading ? "Uploading..." : "Upload"}
                </button>
                {fileUrl && (
                    <div>
                        <p>File upload to: {fileUrl}</p>
                    </div>
                )}

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
               
                <div className = "sliderContainer">
                <input className = "slider"
                    type="range" 
                    min="0" 
                    max="12"
                    step = "0.2"
                    value= {user_hours}
                    id = "myRange"
                    onChange={(e) => set_user_hours(Number(e.target.value))}
                    style = {{
                        background: fill('rgb(47, 115, 164)', 0, 12, user_hours),
                        boxShadow:  `0 0 0 1px #adadad`
                    }}
                />
                <p className="number" style = {{color: 'rgb(47, 115, 164)'}}>{user_hours} <span className="number-small"> hr/wk</span></p>
                </div>
                
                
                <p>How strong was the leadership?</p>
                <div className = "sliderContainer">
                <input className = "slider"
                    type="range" 
                    min="0" 
                    max="10"
                    step = "0.1"
                    value= {user_leadership}
                    onChange={(e) => set_user_leadership(Number(e.target.value))}
                    style = {{
                        background: fill('rgba(82, 50, 6, 1)', 0, 10, user_leadership),
                        boxShadow:  `0 0 0 1px #adadad`
                    }}
                
                />
                <p className="number" style = {{color: 'rgba(82, 50, 6, 1)'}}>{user_leadership} <span className="number-small">/10</span></p>
                </div>
                <p>How fun was this club?</p>
                <div className = "sliderContainer">
                <input className = "slider"
                    type="range" 
                    min="0" 
                    max="10"
                    step = "0.1" 
                    value= {user_fun}
                    onChange={(e) => set_user_fun(Number(e.target.value))}
                    style = {{
                        background: fill('rgba(255, 128, 0, 1)', 0, 10, user_fun),
                        boxShadow:  `0 0 0 1px #adadad`
                    }}
                />
                <p className="number" style = {{color: 'rgba(255, 128, 0, 1)'}}>{user_fun} <span className="number-small">/10</span></p>
                </div>
                <p>How good was the community?</p>
                <div className = "sliderContainer">
                <input className = "slider"
                    type="range" 
                    min="0" 
                    max="10"
                    step = "0.1"
                    value= {user_community}
                    onChange={(e) => set_user_community(Number(e.target.value))}
                    style = {{
                        background: fill('rgba(198, 165, 1, 0.85)', 0, 10, user_community),
                        boxShadow:  `0 0 0 1px #adadad`
                    }}
                />
                <p className="number" style = {{color: 'rgba(198, 165, 1, 0.85)'}}>{user_community} <span className="number-small">/10</span></p>
                </div>
                <p>Skill Growth Index</p>
                <div className = "sliderContainer">
                <input className = "slider"
                    type="range" 
                    min="0" 
                    max="10" 
                    step = "0.1"
                    value= {user_growth}
                    onChange={(e) => set_user_growth(Number(e.target.value))}
                    style = {{
                        background: fill('rgba(124, 124, 124, 0.85)', 0, 10, user_growth),
                        boxShadow:  `0 0 0 1px #adadad`
                    }}
                />
                <p className="number" style = {{color: 'rgba(124, 124, 124, 0.85)'}}>{user_growth} <span className="number-small">/10</span></p>
                </div>
                
                
                <button onClick={post_review} className="post">Post Review</button>
                <p>{warning}</p>
            </div>
            <div className = "vert-flex">
            <div className = "hor-flex">
                <h1 className="instruction-txt">Thanks for sharing, {username}!</h1>
                <img className="raccoon" src={thanksImage} />
            </div>
            <div className="divider" />
            <div className = "hor-flex">
                <p className = "feedback-on">Feedback on {club?.club_name || 'club'}</p>
            <img className="club-img-thanks" src ={club?.image_url}/>
            </div>
            </div>
            
        </div>
    );

    }
