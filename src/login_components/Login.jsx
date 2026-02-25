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

  return <button onClick={handleLogin}>Sign in with Google</button>;
}

export default Login;

/*
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'example@email.com',
  password: 'example-password',
})
*/
//use this as the "regular" sign in method 