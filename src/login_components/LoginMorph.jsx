
import { useState, useEffect } from "react";
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from "framer-motion";
import Logout from "./Logout";
import Form from "./form";
import ForgotPasswordForm from "./ForgotPasswordForm";
import "./LoginMorph.css";
import { useGlobalStore } from "../lib/store";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { apiFetch } from "../lib/api";

function LoginMorph({ open, setOpen }) {
  let GlobalValue = useGlobalStore((state) => state.GlobalValue);
  const setLastPath = useGlobalStore((state) => state.setLastPath);
  const navigate = useNavigate();
  const location = useLocation();
  const isProfilePage = location.pathname === '/profile';
  const [view, setView] = useState("login");
  const [avatarUrl, setAvatarUrl] = useState(null);

  useEffect(() => {
    if (!GlobalValue) { setAvatarUrl(null); return; }
    apiFetch('/me/profile')
      .then((profile) => setAvatarUrl(profile?.avatar_url))
      .catch(() => {});
  }, [GlobalValue]);

  useEffect(() => {
    if (!open) setView("login");
  }, [open]);

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

  const handleGoogleSignIn = async () => {
    setLastPath(location.pathname + location.search);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) console.error(error);
  };

  const viewHeading = {
    login: "Login",
    signup: "Sign Up",
    forgot: "Reset Password",
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
            &times;
          </button>
          <img className="raccoon" src="/raccoon_pfp.png" />
          <h2>{viewHeading[view]}</h2>

          {view !== "forgot" && (
            <>
              <button className="oauth-btn google-btn" onClick={handleGoogleSignIn} type="button">
                <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#34A853" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                Sign in with Google
              </button>

              <div className="auth-divider">
                <span>or</span>
              </div>
            </>
          )}

          {view === "forgot" ? (
            <ForgotPasswordForm onBack={() => setView("login")} />
          ) : (
            <Form isSignUp={view === "signup"} onAuth={handleAuth} />
          )}

          {view === "login" && (
            <button
              className="forgot-password-btn"
              type="button"
              onClick={() => setView("forgot")}
            >
              Forgot password?
            </button>
          )}

          {view !== "forgot" && (
            <button
              className="toggle-auth-btn"
              type="button"
              onClick={() => setView(view === "login" ? "signup" : "login")}
            >
              {view === "signup"
                ? "Already have an account? Login"
                : "Don't have an account? Sign up"}
            </button>
          )}

          <button className="need-help-btn" type="button">
            Need help?
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default LoginMorph;
