import React from "react";
import "./form.css";

function Form(props){
  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) console.error(error);
  };
  
    return (
        <form className = "input-field">
            <input type = "text" placeholder ="Prefered name"/>
            <input type = "text" placeholder="Email"/>
            <input type  = "password" placeholder="Password" />
            <button type = "submit" onClick={handleLogin}>{props.isRegistered ? "Sign up": "Register"}</button>
        </form>
    );
}

export default Form;