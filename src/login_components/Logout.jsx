import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { useGlobalStore } from "../lib/store";

function Logout({ className = '', style }) {
  const navigate = useNavigate();
  const lastPath = useGlobalStore((state) => state.lastPath);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // After logout, replace the current history entry so back button doesn't return to profile/login
    navigate(lastPath || "/", { replace: true });
  };

  return (
    <button className={`logout-btn ${className}`.trim()} style={style} onClick={handleLogout}>
      Logout
    </button>
  );
}

export default Logout;