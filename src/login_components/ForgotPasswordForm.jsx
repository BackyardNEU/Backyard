import { useState } from "react";
import { supabase } from "../lib/supabase";
import "./form.css";

function ForgotPasswordForm({ onBack }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch (err) {
      setError(err.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="forgot-success">
        <p>Check your email for a password reset link.</p>
        <button type="button" className="toggle-auth-btn" onClick={onBack}>
          Back to login
        </button>
      </div>
    );
  }

  return (
    <form className="input-field" onSubmit={handleSubmit}>
      <p className="forgot-instructions">
        Enter the email you signed up with and we'll send you a reset link.
      </p>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={loading}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? "Sending..." : "Send Reset Link"}
      </button>
      {error && <div className="form-error">{error}</div>}
      <button type="button" className="toggle-auth-btn" onClick={onBack}>
        Back to login
      </button>
    </form>
  );
}

export default ForgotPasswordForm;
