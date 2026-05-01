import React, {useState, useEffect, useRef} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import ReviewPage from "../review_components/ReviewPage";
import "./ExpandedTile.css";
import ReviewList from "../review_components/ReviewList"; 
import { supabase } from '../supabase';
import { useClubData } from '../context/useClubData';
import logImage from '/src/assets/logImage.png';
import ColorThief from "colorthief";


function ExpandedTile({club, onClose, onMembershipChange}){
    const [isOpen, setIsOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [reviews, set_reviews] = useState([]);
    const [isClicked, setIsClicked] = useState(false);
    const [animating, setAnimating] = useState(false);
    const [dominantColor, setDominantColor] = useState(null);
    const [club_stats, setClubStats] = useState(null);
    const [user, setUser] = useState(null);
    const [isMember, setIsMember] = useState(false);
    const [memberLoading, setMemberLoading] = useState(false);
    const imgRef = useRef(null);
    const { clubTopTags } = useClubData();
    const topTags = clubTopTags?.get(club.id) || [];
    const id  = club.id;
    
    

    //escape key will close tile
    useEffect(() => {
        const handler = (e) => {
            if (e.key === "Escape") handleClose();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    const handleClose = () => {
        setIsClosing(true);
        onClose();
    };

    const handleClick = () => {
    setIsOpen(!isOpen); 
    
    // 2. Trigger the "Image" state and the "Pop" animation
    setIsClicked(true);
    setAnimating(true);

    // 3. After the animation finishes (250ms), swap back to the button
    setTimeout(() => {
        setIsClicked(false);
        setAnimating(false);
    }, 350); 
    }

    // colortheif

    const getPastelColor = (r, g, b) => {
        const factor = (r + (255 - r) * 0.85 >= 240 &&
                        g + (255 - g) * 0.85 >= 240 &&
                        b + (255 - b) * 0.85 >= 240) ? 0.5 : 0.85;

        const pastelR = Math.round(r + (255 - r) * factor);
        const pastelG = Math.round(g + (255 - g) * factor);
        const pastelB = Math.round(b + (255 - b) * factor);

        return `rgb(${pastelR}, ${pastelG}, ${pastelB})`;
    };

    
    useEffect (() => {
        const colorThief = new ColorThief();
        const img = imgRef.current;

        const getColor = () => {
            try {
                const [r, g, b] = colorThief.getColor(img);
                setDominantColor(getPastelColor(r, g, b));
            } catch {
                setDominantColor('rgb(211, 211, 211)');
            }
        };

        if (!img || !img.src) {
            setDominantColor('rgb(211, 211, 211)');
            return;
        }

        if (img.complete) {
            getColor();
        } else {
            img.addEventListener("load", getColor);
            img.addEventListener("error", () => setDominantColor('rgb(211, 211, 211)'));
            return () => {
                img.removeEventListener("load", getColor);
                img.removeEventListener("error", () => setDominantColor('rgb(211, 211, 211)'));
            };
        }
    }, [club.image_url]);

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
                console.log("Incoming data: ", data[0].id, typeof data[0].id);
                set_reviews(data);
            }
            fetch_reviews();
        }, [id])

    useEffect(() => {
        async function fetch_stats(clubId) {
            const { data, error } = await supabase.rpc('get_averages', { p_club_id: clubId });
            if (error) {
                console.error("Error fetching stats:", error);
            } else {
                console.log("Fetched club stats!:", data);
                setClubStats(data[0]);
            }
        }
        fetch_stats(id);
    }, [id]);

    useEffect(() => {
        async function checkMembership() {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) { setUser(null); return; }
            setUser(authUser);

            const { data: profile, error } = await supabase
                .from('profiles')
                .select('member_list')
                .eq('id', authUser.id)
                .single();

            if (error) { console.error('Error fetching membership:', error); return; }
            const list = profile?.member_list || [];
            setIsMember(list.includes(club.id));
        }
        checkMembership();
    }, [club.id]);

    async function handleMembership() {
        if (!user || memberLoading) return;
        setMemberLoading(true);

        const { data: profile } = await supabase
            .from('profiles')
            .select('member_list')
            .eq('id', user.id)
            .single();

        let list = profile?.member_list || [];

        if (isMember) {
            list = list.filter((cid) => cid !== club.id);
        } else {
            list = [...list, club.id];
        }

        const { error } = await supabase
            .from('profiles')
            .update({ member_list: list })
            .eq('id', user.id);

        if (error) {
            console.error('Error updating membership:', error);
        } else {
            const wasJoined = isMember;
            setIsMember(!isMember);
            if (onMembershipChange) onMembershipChange(club.id, !wasJoined);
        }
        setMemberLoading(false);
    }

    useEffect(() => {
        console.log("ExpandedTile MOUNTED");
        return () => console.log("ExpandedTile UNMOUNTED");
    }, []);

    console.log("ExpandedTile RENDER", club.id);

    return (
        <motion.div
            layoutId={`club-${club.id}`}
            className = "expanded-card"
            style={{ pointerEvents: isClosing ? "none" : "auto" }}
            transition={{
                type: "spring",
                stiffness: 400,
                damping: 30
            }}
        >
    
        <button className = "close-btn" onClick={handleClose}>x</button>
            <div className="content-col">
                <div className = "rectangle" style = {{backgroundColor: dominantColor}}>
                    <img
                        ref={imgRef}
                        src={club.image_url}
                        crossOrigin="anonymous"
                        alt={club.name}
                        style={{ display: "none" }}  
                    />
                </div>
                <div className="text-flex">
                    <h2 className="club-name-exp">{club.club_name}</h2>
                    {topTags.length > 0 && <h2 className="club-tag1">{topTags.join(' • ')}</h2>}
                </div>
                
                <div className ="image-stack">
                        <div className = "rectangle_min" style={{ "--dominant-color": dominantColor }} >
                        <img
                        ref={imgRef}
                        src={club.image_url}
                        crossOrigin="anonymous"
                        alt={club.name}
                        style={{ display: "none" }}  
                        />
                        <img className="club-img-exp" src={club.image_url} alt={club.club_name}/>
                        </div>
                </div>
            
            </div>

        {topTags.length > 0 && (
        <div className ="club-tag2">
            {topTags.map((tag) => (<div key={tag} className="tag">{tag}</div>))}
        </div>
        )}
        <p className= "club-description-exp">{club.club_description}</p>
        {user && (
            <button
                className={`membership-btn ${isMember ? 'leave' : 'join'}`}
                onClick={handleMembership}
                disabled={memberLoading}
            >
                {memberLoading ? '...' : isMember ? 'Leave Club' : 'Join Club'}
            </button>
        )}
        <div className="content-col">
    <div className="divider"></div>
</div>
<div className="view-reviews">
    <ReviewList reviews={reviews} club_stats={club_stats} club={club} />
</div>
        <div style = {{marginBottom: "30px"}}>
            <h3>Have you been in this club?</h3>
            <div>{isClicked ? ( <img src = {logImage} className = "log-btn" alt = "Clicked state" /> ) :( 
            <button className={`review-btn`} onClick = {handleClick}>Share your experience</button> )}</div>
        </div>
        {isOpen && (
            <div>
            <ReviewPage clubId={club.id} onClose={() => setIsOpen(false)}/>
            </div>)

        }
        </motion.div>
    );
}

export default React.memo(ExpandedTile);

