import { useGlobalStore } from "../store";

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