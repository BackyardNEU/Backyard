import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import Form from '../login_components/form';
import './JoinPage.css';

export default function JoinPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [invite, setInvite] = useState(null);
  const [inviteError, setInviteError] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(true);

  const [user, setUser] = useState(undefined); // undefined = still resolving
  const [view, setView] = useState('login');

  const [redeemState, setRedeemState] = useState(null); // null | 'loading' | 'success' | 'already' | string (error)

  // Store token so AuthCallbackPage and ProfileSetupPage can redirect back here after auth
  useEffect(() => {
    sessionStorage.setItem('pendingJoinToken', token);
  }, [token]);

  // Resolve current auth state
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
  }, []);

  // Fetch invite info (public — just needs the token)
  useEffect(() => {
    apiFetch(`/invite/${token}`, { auth: false })
      .then((data) => { setInvite(data); setInviteLoading(false); })
      .catch((err) => { setInviteError(err.message); setInviteLoading(false); });
  }, [token]);

  const redeem = async () => {
    setRedeemState('loading');
    try {
      const result = await apiFetch(`/invite/${token}/redeem`, { method: 'POST' });
      sessionStorage.removeItem('pendingJoinToken');
      setRedeemState(result.already_member ? 'already' : 'success');
    } catch (err) {
      setRedeemState(err.message || 'Something went wrong');
    }
  };

  const handleAuth = async (flow) => {
    if (flow === 'signup') {
      // New user: needs profile setup. sessionStorage token is already set,
      // ProfileSetupPage will redirect back here on completion.
      navigate('/profile-setup');
      return;
    }
    // Existing user signed in: refresh user state and redeem
    const { data } = await supabase.auth.getUser();
    setUser(data.user);
    redeem();
  };

  const handleGoogleSignIn = async () => {
    // sessionStorage token already set; AuthCallbackPage will redirect back here
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) console.error(error);
  };

  if (inviteLoading || user === undefined) {
    return (
      <div className="join-page">
        <div className="join-card">
          <p className="join-loading">Loading...</p>
        </div>
      </div>
    );
  }

  if (inviteError) {
    return (
      <div className="join-page">
        <div className="join-card join-card--error">
          <h2>Link unavailable</h2>
          <p>{inviteError}</p>
          <button className="join-home-btn" onClick={() => navigate('/')}>Go home</button>
        </div>
      </div>
    );
  }

  if (redeemState === 'success') {
    return (
      <div className="join-page">
        <div className="join-card join-card--success">
          {invite.club_image && <img className="join-club-logo" src={invite.club_image} alt={invite.club_name} />}
          <h2>You've joined {invite.club_name}!</h2>
          <p>You're now a member. Check them out on Backyard.</p>
          <button className="join-home-btn" onClick={() => navigate('/')}>Explore clubs</button>
        </div>
      </div>
    );
  }

  if (redeemState === 'already') {
    return (
      <div className="join-page">
        <div className="join-card">
          {invite.club_image && <img className="join-club-logo" src={invite.club_image} alt={invite.club_name} />}
          <h2>{invite.club_name}</h2>
          <p>You're already a member of this club.</p>
          <button className="join-home-btn" onClick={() => navigate('/')}>Go home</button>
        </div>
      </div>
    );
  }

  // Logged in: show join button
  if (user) {
    return (
      <div className="join-page">
        <div className="join-card">
          {invite.club_image && <img className="join-club-logo" src={invite.club_image} alt={invite.club_name} />}
          <h2>{invite.club_name}</h2>
          <p className="join-subtitle">You've been invited to join this club on Backyard.</p>
          {typeof redeemState === 'string' && <p className="join-error">{redeemState}</p>}
          <button
            className="join-confirm-btn"
            onClick={redeem}
            disabled={redeemState === 'loading'}
          >
            {redeemState === 'loading' ? 'Joining...' : 'Join Club'}
          </button>
        </div>
      </div>
    );
  }

  // Not logged in: show auth form
  return (
    <div className="join-page">
      <div className="join-card">
        {invite.club_image && <img className="join-club-logo" src={invite.club_image} alt={invite.club_name} />}
        <h2>{invite.club_name}</h2>
        <p className="join-subtitle">
          {view === 'signup'
            ? `Create an account to join ${invite.club_name} on Backyard.`
            : `Sign in to join ${invite.club_name} on Backyard.`}
        </p>

        <button className="oauth-btn google-btn" onClick={handleGoogleSignIn} type="button">
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#34A853" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continue with Google
        </button>

        <div className="auth-divider"><span>or</span></div>

        <Form isSignUp={view === 'signup'} onAuth={handleAuth} />

        <button
          className="toggle-auth-btn"
          type="button"
          onClick={() => setView(view === 'login' ? 'signup' : 'login')}
        >
          {view === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Login'}
        </button>
      </div>
    </div>
  );
}
