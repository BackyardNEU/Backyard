
import React, { useState } from "react";
import { supabase } from "../supabase";
import "./form.css";

function Form({ isSignUp = false, onAuth }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignUp) {
        // Sign up — store username in user metadata so AuthListener can
        // create the profile row once the session is confirmed
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        if (signUpError) throw signUpError;
        if (onAuth) onAuth();
      } else {
        // Login
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        if (onAuth) onAuth();
      }
    } catch (err) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="input-field" onSubmit={handleSubmit}>
      {isSignUp && (
        <input
          type="text"
          placeholder="Preferred name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
          required
        />
      )}
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={loading}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={loading}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? (isSignUp ? "Signing up..." : "Logging in...") : isSignUp ? "Sign up" : "Login"}
      </button>
      {error && <div className="form-error">{error}</div>}
    </form>
  );
}

export default Form;