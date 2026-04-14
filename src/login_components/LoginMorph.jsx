
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Logout from "./Logout";
import Form from "./form";
import "./LoginMorph.css";
import { useGlobalStore } from "../store";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../supabase";



function LoginMorph({ open, setOpen }) {
  let GlobalValue = useGlobalStore((state) => state.GlobalValue);
  const navigate = useNavigate();
  const location = useLocation();
  const [isSignUp, setIsSignUp] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const categories = [
    { label: "Calendar", category: "calendar" },
    { label: "Favorites", category: "favorites" },
    { label: "FSL", category: "fsl" },
    { label: "Intramurals", category: "intramural_sports" },
    { label: "Affinity", category: "affiliation" },
    { label: "Environment", category: "nature" },
    { label: "Literature", category: "lit" },
    { label: "Comp Sci", category: "programming" },
    { label: "Performing", category: "performing" },
    { label: "Music", category: "music" },
    { label: "Visual Arts", category: "visual_arts" },
    { label: "Engineering", category: "engineering" },
    { label: "Science", category: "science" },
    { label: "Resources", category: "resources" },
    { label: "Business", category: "business" },
    { label: "Medicine", category: "medicine" },
    { label: "Math", category: "math" },
    { label: "Law", category: "law" },
    { label: "Fun", category: "fun" },
  ];

  useEffect(() => {
    if (!GlobalValue) { setAvatarUrl(null); return; }
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) return;
      supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', data.user.id)
        .single()
        .then(({ data: profile }) => setAvatarUrl(profile?.avatar_url));
    });
  }, [GlobalValue]);

  const handleProfileClick = () => {
    setOpen(false);
    navigate("/profile");
  };

  const handleAuth = () => {
    setOpen(false);
    navigate("/profile");
  };

  const handleCategorySelect = (category) => {
    window.dispatchEvent(
      new CustomEvent("backyard-category-select", { detail: { category } })
    );
    setMenuOpen(false);
  };

  return (
    <AnimatePresence>
      {!open && (
        <div className="logged-in-controls">
          {location.pathname.startsWith("/university/") && (
            <div className="hamburger-menu-wrapper">
              <button
                className="hamburger-btn"
                type="button"
                aria-label="Open club categories"
                onClick={() => setMenuOpen((prev) => !prev)}
              >
                ☰
              </button>
              {menuOpen && (
                <div className="hamburger-dropdown">
                  {categories.map((item) => (
                    <button
                      key={item.category}
                      type="button"
                      className="hamburger-item"
                      onClick={() => handleCategorySelect(item.category)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {GlobalValue && <Logout />}
          <motion.button
            layoutId="login"
            className="login-icon"
            onClick={GlobalValue ? handleProfileClick : () => setOpen(true)}
          >
            <img src={avatarUrl || "/raccoon_pfp.png"} alt={GlobalValue ? "Profile" : "Login"} />
          </motion.button>
        </div>
      )}
      {open && (
        <motion.div
          layoutId="login"
          className="login-card"
        >
          <button className="close-btn" onClick={() => setOpen(false)}>
            ×
          </button>
          <img className="raccoon" src="/raccoon_pfp.png" />
          <h2>{isSignUp ? "Sign Up" : "Login"}</h2>
          <Form isSignUp={isSignUp} onAuth={handleAuth} />
          <button
            className="toggle-auth-btn"
            type="button"
            onClick={() => setIsSignUp((prev) => !prev)}
          >
            {isSignUp ? "Already have an account? Login" : "Don't have an account? Sign up"}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default LoginMorph;