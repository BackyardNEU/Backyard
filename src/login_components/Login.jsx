import { supabase } from "../supabase";
import { useLocation } from "react-router-dom";
import { useGlobalStore } from "../store";

function Login() {
  const location = useLocation();
  const setLastPath = useGlobalStore((state) => state.setLastPath);

  const handleLogin = async () => {
    // Remember where the user was before logging in so logout can return them there
    setLastPath(location.pathname + location.search);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Send users directly to the profile page after successful sign-in
        redirectTo: `${window.location.origin}/profile`,
      },  
    });

    if (error) console.error(error);
  };

  return <button onClick={handleLogin}>Sign in with Google</button>;
}
//change final line to sign up link page

export default Login;

/*
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'example@email.com',
  password: 'example-password',
})
*/
//use this as the "regular" sign in method 