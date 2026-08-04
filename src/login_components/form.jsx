
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { apiFetch } from "../lib/api";
import BorderedInput from "./BorderedInput";
import "./form.css";

function Form({ isSignUp = false, onAuth, onFirstNameCommit, needHelpButton, toggleAuthButton }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState(null);

  const checkUsername = useCallback(async (value) => {
    if (!value || value.length < 3 || !/^[a-zA-Z0-9_]+$/.test(value)) {
      setUsernameStatus(null);
      return;
    }
    try {
      const { available, reason } = await apiFetch(
        `/users/check-username?username=${encodeURIComponent(value)}`,
        { auth: false }
      );
      setUsernameStatus(available ? "available" : reason || "taken");
    } catch {
      setUsernameStatus(null);
    }
  }, []);

  useEffect(() => {
    if (!isSignUp || !username) { setUsernameStatus(null); return; }
    const timer = setTimeout(() => checkUsername(username), 400);
    return () => clearTimeout(timer);
  }, [username, isSignUp, checkUsername]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignUp) {
        if (!firstName.trim() || !lastName.trim()) {
          throw new Error("First and last name are required");
        }
        if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
          throw new Error("Username must be 3-30 alphanumeric or underscore characters");
        }
        if (usernameStatus && usernameStatus !== "available") {
          throw new Error("That username is already taken");
        }

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              full_name: `${firstName.trim()} ${lastName.trim()}`,
            },
            emailRedirectTo: `${window.location.origin}/auth/callback?flow=signup`,
          },
        });
        
        if (signUpError) {
          throw signUpError; 
        }

        if (signUpData?.session) {
          await apiFetch("/me/profile", {
            method: "POST",
            body: {
              username: username.trim(),
              first_name: firstName.trim(),
              last_name: lastName.trim(),
            },
          });
          if (onAuth) onAuth("signup");
        } else {
          setError("Check your email to confirm your account before logging in.");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        if (onAuth) onAuth("signin");
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
        <>
          <div className="name-row">
            <BorderedInput
              type="text"
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              onBlur={() => onFirstNameCommit && onFirstNameCommit(firstName.trim())}
              disabled={loading}
              required
            />
            <BorderedInput
              type="text"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div className="username-field">
            <BorderedInput
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
              disabled={loading}
              required
              minLength={3}
              maxLength={30}
            />
            {usernameStatus === "available" && (
              <span className="username-ok">Available</span>
            )}
            {usernameStatus && usernameStatus !== "available" && (
              <span className="username-taken">
                {usernameStatus === "taken" ? "Taken" : usernameStatus}
              </span>
            )}
          </div>
        </>
      )}
      <BorderedInput
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={loading}
        required
      />
      <BorderedInput
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={loading}
        required
      />
      <div className="submit-row">
        {needHelpButton}
        <div className="duo-btn-wrap auth-submit-wrap">
          <div className="duo-btn-pill" aria-hidden="true" />
          <button
            type="submit"
            disabled={loading}
            className="auth-submit-btn duo-btn"
            style={{ '--duo-shadow': 'rgb(30, 80, 95)' }}
          >
            {loading ? (isSignUp ? "Signing up..." : "Logging in...") : isSignUp ? "Sign up" : "Login"}
          </button>
        </div>
        {toggleAuthButton}
      </div>
      {error && <div className="form-error">{error}</div>}
    </form>
  );
}

export default Form;
