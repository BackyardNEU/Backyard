import { motion, AnimatePresence } from "framer-motion";
import Login from "./Login";
import Logout from "./Logout"
import Form from "./form";
import "./LoginMorph.css";
import { useGlobalStore } from "../store";


function LoginMorph({ open, setOpen }) {
  let GlobalValue = useGlobalStore((state) => state.GlobalValue);

  return (
    <AnimatePresence>
      {!open && (
       
        <motion.button
          layoutId="login"
          className="login-icon"
          onClick={() => setOpen(true)}
        >
          <img src="/raccoon_pfp.png" />
        </motion.button>
 
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