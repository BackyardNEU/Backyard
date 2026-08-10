import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import BorderedInput from "./BorderedInput";
import "./form.css";
import { Skeleton, SkeletonRegion } from '../components/Skeleton';

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
      setTimeout(() => navigate("/profile", { replace: true }), 2000);
    } catch (err) {
      setError(err.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="reset-page">
        <div className="reset-card">
          <img className="raccoon" src="/raccoon_pfp.png" alt="Backyard" />
          <SkeletonRegion label="Loading">
            <Skeleton width="60%" height="1.4rem" style={{ margin: '0 auto 12px' }} />
            <Skeleton height="2.4rem" radius={4} />
          </SkeletonRegion>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="reset-page">
        <div className="reset-card">
          <img className="raccoon" src="/raccoon_pfp.png" alt="Backyard" />
          <h2>Password Updated</h2>
          <p>Redirecting to your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-page">
      <div className="reset-card">
        <img className="raccoon" src="/raccoon_pfp.png" alt="Backyard" />
        <h2>Set a New Password</h2>
        <form className="input-field" onSubmit={handleSubmit}>
          <BorderedInput
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
            minLength={6}
          />
          <BorderedInput
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? "Updating..." : "Update Password"}
          </button>
          {error && <div className="form-error">{error}</div>}
        </form>
      </div>
    </div>
  );
}

export default ResetPasswordPage;
