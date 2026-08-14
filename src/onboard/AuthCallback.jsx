import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Where Supabase sends people after they confirm their email.
 *
 * form.jsx builds emailRedirectTo from window.location.origin, which on this deployment
 * is the onboarding domain — so this route has to exist here or every confirmation link
 * 404s. All it does is read back the token stashed on arrival and return the person to
 * their club, which is the whole reason the stash exists: the round trip through an
 * inbox destroys React state and URL params.
 */
export default function AuthCallback() {
    const navigate = useNavigate();

    useEffect(() => {
        const token = sessionStorage.getItem('pendingClaimToken');
        // detectSessionInUrl in lib/supabase.js consumes the hash fragment on load, so by
        // the time this runs the session is already established.
        navigate(token ? `/claim/${token}` : '/claim/missing', { replace: true });
    }, [navigate]);

    return (
        <div className="ob-page">
            <div className="ob-card ob-card--narrow ob-centered">
                <p className="ob-lede" style={{ margin: 0 }}>Signing you in…</p>
            </div>
        </div>
    );
}
