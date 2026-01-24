import { supabase } from "../supabase"

function Logout() {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <button onClick={handleLogout}>
      Logout
    </button>
  );
}

export default Logout;