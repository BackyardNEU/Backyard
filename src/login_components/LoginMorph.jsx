
import { motion, AnimatePresence } from "framer-motion";
import Login from "./Login";
import Logout from "./Logout";
import Form from "./form";
import "./LoginMorph.css";
import { useGlobalStore } from "../store";
import { useNavigate } from "react-router-dom";



function LoginMorph({ open, setOpen }) {
  let GlobalValue = useGlobalStore((state) => state.GlobalValue);
  const navigate = useNavigate();

  const handleProfileClick = () => {
    setOpen(false);
    navigate("/profile");
  };

  return (
    <AnimatePresence>
      {!open && (
        <div className="logged-in-controls">
          {GlobalValue && <Logout />}
          <motion.button
            layoutId="login"
            className="login-icon"
            onClick={GlobalValue ? handleProfileClick : () => setOpen(true)}
          >
            <img src="/raccoon_pfp.png" alt={GlobalValue ? "Profile" : "Login"} />
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
          <h2>Welcome</h2>
          <Form isRegistered={true} />
          {!GlobalValue ? <Login /> : <Logout />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default LoginMorph;