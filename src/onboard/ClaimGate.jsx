import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import Form from '../login_components/form';
import WizardShell from './WizardShell.jsx';

/**
 * Everything before the wizard: resolve the token, show the club it belongs to, get the
 * person an account, and redeem.
 *
 * The token stash is the load-bearing piece. Signing up sends people to their inbox, and
 * they come back through /auth/callback with no URL params and no React state — so the
 * token goes into sessionStorage on arrival and is read back on return. This mirrors
 * JoinPage.jsx, which solved the same problem for member invites.
 */
export default function ClaimGate() {
    const { token } = useParams();

    const [invite, setInvite] = useState(null);
    const [inviteError, setInviteError] = useState(null);
    const [user, setUser] = useState(undefined); // undefined = still resolving
    const [claim, setClaim] = useState(null);    // null | 'working' | {club_id,...} | error string
    const [mode, setMode] = useState('signup');

    useEffect(() => {
        if (token) sessionStorage.setItem('pendingClaimToken', token);
    }, [token]);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));

        // form.jsx only calls onAuth when signUp returns a session. With email
        // confirmation enabled it returns none — it just shows its own "check your
        // inbox" message — so onAuth never fires and nothing else here would notice the
        // session appearing after the user returns through /auth/callback.
        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) setUser(session.user);
        });
        return () => sub?.subscription?.unsubscribe();
    }, []);

    useEffect(() => {
        apiFetch(`/invite/${token}`, { auth: false })
            .then(setInvite)
            .catch((err) => setInviteError(err.message));
    }, [token]);

    const redeem = async () => {
        setClaim('working');
        try {
            // The main app creates the profiles row via AuthListener and the
            // /profile-setup bounce, neither of which exists in this bundle. Without a
            // row, addToMemberList updates zero rows and profiles.member_list — which
            // clubEvents.js and events.js read — never learns about the club.
            // POST /me/profile is an upsert keyed on the JWT, so this is safe to repeat.
            //
            // Carry over the names Supabase stored as user metadata at signup. Sending an
            // empty body created a bare row and silently discarded what the person had
            // just typed — profiles.js drops empty strings, so passing them through is
            // safe even when the metadata is absent (Google OAuth uses given/family_name).
            const meta = (await supabase.auth.getUser()).data.user?.user_metadata ?? {};
            await apiFetch('/me/profile', {
                method: 'POST',
                body: {
                    first_name: meta.first_name || meta.given_name || '',
                    last_name: meta.last_name || meta.family_name || '',
                },
            });

            const result = await apiFetch(`/invite/${token}/redeem`, { method: 'POST' });
            sessionStorage.removeItem('pendingClaimToken');
            setClaim(result);
        } catch (err) {
            setClaim(err.message || 'Something went wrong. Try the link again.');
        }
    };

    // Redeeming is idempotent, so someone already signed in can go straight through.
    useEffect(() => {
        if (user && invite && claim === null) redeem();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, invite]);

    // Only fires when signUp or signIn returned a session — i.e. email confirmation is
    // off, or this was a sign-in. When confirmation is ON, form.jsx shows its own
    // check-your-inbox message and never calls this; the onAuthStateChange subscription
    // above is what picks the user up when they return through /auth/callback.
    //
    // Unlike the main app there is no /profile-setup bounce here — the wizard collects
    // what it needs itself.
    const handleAuth = async () => {
        const { data } = await supabase.auth.getUser();
        if (data.user) setUser(data.user);
    };

    if (inviteError) {
        return (
            <Page>
                <div className="ob-card ob-card--narrow ob-centered">
                    <h1 className="ob-h1">This link isn&apos;t working</h1>
                    <p className="ob-lede" style={{ margin: '0 auto' }}>
                        It may have expired or been replaced. Email{' '}
                        <a href="mailto:hello@explorethebackyard.com">hello@explorethebackyard.com</a>{' '}
                        and we&apos;ll send you a fresh one.
                    </p>
                </div>
            </Page>
        );
    }

    if (!invite || user === undefined) {
        return (
            <Page>
                <div className="ob-card ob-card--narrow ob-centered" aria-busy="true">
                    <div className="ob-skeleton" style={{ height: 30, width: '65%', margin: '0 auto 14px' }} />
                    <div className="ob-skeleton" style={{ height: 15, width: '85%', margin: '0 auto 8px' }} />
                    <div className="ob-skeleton" style={{ height: 44, width: 190, margin: '22px auto 0', borderRadius: 999 }} />
                    <span className="ob-hint">Loading your club…</span>
                </div>
            </Page>
        );
    }

    if (claim && typeof claim === 'object') {
        return <WizardShell clubId={claim.club_id} clubName={invite.club_name} clubLogo={invite.club_image} />;
    }

    if (typeof claim === 'string' && claim !== 'working') {
        return (
            <Page clubName={invite.club_name}>
                <div className="ob-card ob-card--narrow ob-centered">
                    <h1 className="ob-h1">We couldn&apos;t open your page</h1>
                    <p className="ob-lede" style={{ margin: '0 auto 18px' }}>{claim}</p>
                    <button className="ob-btn" onClick={redeem}>Try again</button>
                </div>
            </Page>
        );
    }

    if (claim === 'working') {
        return (
            <Page clubName={invite.club_name}>
                <div className="ob-card ob-card--narrow ob-centered">
                    <p className="ob-lede" style={{ margin: 0 }}>Opening your page…</p>
                </div>
            </Page>
        );
    }

    // The "check your email" screen that used to live here was unreachable: it was gated
    // on a mode only handleAuth could set, and handleAuth never runs when confirmation is
    // enabled. Form renders its own inline message in that case, which is the one people
    // actually see, so the duplicate is gone rather than left as dead code.
    return (
        <Page clubName={invite.club_name}>
            <div className="ob-card ob-card--narrow" style={{ padding: 'clamp(24px, 4vw, 40px)' }}>
                {invite.club_image && (
                    <img className="ob-logo-preview" src={invite.club_image} alt="" style={{ marginBottom: 16 }} />
                )}
                <p className="ob-eyebrow">Club setup</p>
                <h1 className="ob-h1">Set up {invite.club_name} on Backyard</h1>
                <p className="ob-lede">
                    You&apos;ll build the page students see when they find your club. It takes
                    about ten minutes, and you can stop and come back to this link any time.
                </p>

                <Form
                    isSignUp={mode === 'signup'}
                    onAuth={handleAuth}
                    toggleAuthButton={
                        <button
                            type="button"
                            className="ob-link"
                            onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}
                        >
                            {mode === 'signup'
                                ? 'Already have a Backyard account? Sign in'
                                : 'Need an account? Sign up'}
                        </button>
                    }
                />
            </div>
        </Page>
    );
}

function Page({ children, clubName }) {
    return (
        <div className="ob-page">
            <header className="ob-brand">
                <h1 className="ob-wordmark">Backyard</h1>
                {clubName && <span className="ob-club-tag">{clubName}</span>}
            </header>
            {children}
        </div>
    );
}
