import { supabase } from "../supabase";
import { useNavigate } from "react-router-dom";
import { useGlobalStore } from "../store";

function Logout() {
  const navigate = useNavigate();
  const lastPath = useGlobalStore((state) => state.lastPath);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // After logout, replace the current history entry so back button doesn't return to profile/login
    navigate(lastPath || "/", { replace: true });
  };

  return (
    <button className="logout-btn" onClick={handleLogout}>
      Logout
    </button>
  );
}

export default Logout;