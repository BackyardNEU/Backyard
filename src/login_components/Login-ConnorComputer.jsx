import { supabase } from "../supabase";

function Login() {
  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) console.error(error);
  };

  return <button onClick={handleLogin}>sign in with Google</button>;
}

export default Login;