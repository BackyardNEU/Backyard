
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Logout from "./Logout";
import Form from "./form";
import "./LoginMorph.css";
import { useGlobalStore } from "../lib/store";
import { useNavigate, useLocation } from "react-router-dom";
import { apiFetch } from "../lib/api";



function LoginMorph({ open, setOpen }) {
  let GlobalValue = useGlobalStore((state) => state.GlobalValue);
  const navigate = useNavigate();
  const location = useLocation();
  const isProfilePage = location.pathname === '/profile';
const [isSignUp, setIsSignUp] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);

  useEffect(() => {
    if (!GlobalValue) { setAvatarUrl(null); return; }
    // backend resolves the user from the JWT — no need for supabase.auth.getUser() first
    apiFetch('/me/profile')
      .then((profile) => setAvatarUrl(profile?.avatar_url))
      .catch(() => {});
  }, [GlobalValue]);

  const handleProfileClick = () => {
    setOpen(false);
    navigate("/profile");
  };

  const handleAuth = (flow) => {
    setOpen(false);
    if (flow === 'signup') {
      navigate('/profile-setup');
      return;
    }
    navigate('/profile');
  };

  return (
    <AnimatePresence>
      {!open && !isProfilePage && (
        <div className="logged-in-controls">
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