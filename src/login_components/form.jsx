
import React, { useState } from "react";
import { supabase } from "../supabase";
import "./form.css";

function Form({ isRegistered = false, onAuth }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Helper to insert user into custom users table
  const insertUserToTable = async (userId, username, emailVal, passwordVal, avatarUrl = null) => {
    // Insert or upsert into your profiles table
    const { error: userTableError } = await supabase
      .from("profiles")
      .upsert([
        {
          username: username,
          email: emailVal,
          password: passwordVal,
          avatar_url: avatarUrl,
        },
      ], { onConflict: ["id"] });
    if (userTableError) throw userTableError;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isRegistered) {
        // Sign up
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        if (signUpError) throw signUpError;
        // Insert into users table
        const userId = data?.user?.id;
        if (userId) {
          await insertUserToTable(userId, name, email, password, null);
        }
        if (onAuth) onAuth();
      } else {
        // Login
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        // Insert or update user info (in case info changed)
        const userId = data?.user?.id;
        if (userId) {
          await insertUserToTable(userId, name, email, password, null);
        }
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
      <input
        type="text"
        placeholder="Preferred name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={loading}
        required={isRegistered}
      />
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
        {loading ? (isRegistered ? "Signing up..." : "Logging in...") : isRegistered ? "Sign up" : "Login"}
      </button>
      {error && <div className="form-error">{error}</div>}
    </form>
  );
}

export default Form;