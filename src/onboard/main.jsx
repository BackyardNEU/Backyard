import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './onboard.css';

const root = createRoot(document.getElementById('root'));

// Loaded dynamically so a module-level throw is catchable.
//
// src/lib/supabase.js throws during import when VITE_SUPABASE_URL or VITE_SUPABASE_KEY
// are missing, which happens when the Vercel project is deployed without them. A static
// import means that throw kills the bundle before React exists — no error boundary can
// help, and the page renders as nothing but the background colour. A club president
// hitting that has no idea whether the link is broken, the site is down, or they did
// something wrong.
import('./OnboardApp.jsx')
    .then((mod) => {
        const OnboardApp = mod.default;
        root.render(
            <StrictMode>
                <OnboardApp />
            </StrictMode>
        );
    })
    .catch((error) => {
        console.error('[onboard] failed to start:', error);

        const misconfigured = /supabase environment/i.test(error?.message ?? '');

        root.render(
            <div className="ob-page">
                <header className="ob-brand">
                    <h1 className="ob-wordmark ob-wordmark--text">Backyard</h1>
                </header>
                <div className="ob-card ob-card--narrow ob-centered">
                    <h2 className="ob-h1">We couldn&apos;t load the page</h2>
                    <p className="ob-lede" style={{ margin: '0 auto 18px' }}>
                        Something went wrong on our end, not yours. Try refreshing. If it keeps
                        happening, email{' '}
                        <a href="mailto:hello@explorethebackyard.com">
                            hello@explorethebackyard.com
                        </a>{' '}
                        and we&apos;ll sort it out.
                    </p>
                    {misconfigured && (
                        <p className="ob-hint">
                            Deploy note: this build is missing its Supabase environment
                            variables.
                        </p>
                    )}
                </div>
            </div>
        );
    });
