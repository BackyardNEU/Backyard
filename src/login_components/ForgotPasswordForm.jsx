import { useState } from "react";
import { supabase } from "../lib/supabase";
import BorderedInput from "./BorderedInput";
import "./form.css";

function ForgotPasswordForm({ onBack, needHelpButton }) {
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
          BACK TO LOGIN
        </button>
      </div>
    );
  }

  return (
    <form className="input-field" onSubmit={handleSubmit}>
      <p className="forgot-instructions">
        Enter the email you signed up with and we'll send you a reset link.
      </p>
      <BorderedInput
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={loading}
        required
      />
      <div className="duo-btn-wrap reset-submit-wrap">
        <div className="duo-btn-pill" aria-hidden="true" />
        <button
          type="submit"
          disabled={loading}
          className="reset-submit-btn duo-btn"
          style={{ '--duo-shadow': 'rgb(30, 80, 95)' }}
        >
          {loading ? "Sending..." : "Send Reset Link"}
        </button>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="submit-row">
        {needHelpButton}
        <button type="button" className="toggle-auth-btn" onClick={onBack}>
          BACK TO LOGIN
        </button>
      </div>
    </form>
  );
}

export default ForgotPasswordForm;
