import { useNavigate } from 'react-router-dom';
import { DEFAULT_UNIVERSITY_PATH } from '../lib/university';
import raccoon from '../assets/rac7.0.png';
import './NotFoundPage.css';

/**
 * The catch-all page, and the page /admin shows to anyone who is not an admin.
 *
 * Deliberately the same component in both cases. A distinct "access denied" screen
 * confirms that /admin exists and that the account simply lacks the role, which is a
 * free hint to anyone probing. This is not the access control — every admin endpoint
 * is gated server side on ADMIN_USER_IDS — it just stops the UI narrating the map.
 *
 * There is no root landing route (/ redirects to DEFAULT_UNIVERSITY_PATH), so "home"
 * means the default university rather than /.
 */
export default function NotFoundPage() {
    const navigate = useNavigate();

    return (
        <div className="nf-page">
            <img className="nf-mascot" src={raccoon} alt="" aria-hidden="true" />

            <p className="nf-code">Error 404</p>
            <h1 className="nf-title">This page wandered off</h1>
            <p className="nf-lede">
                We couldn&apos;t find what you were looking for. It may have moved, or the
                link might be out of date.
            </p>

            <div className="nf-actions">
                <button
                    type="button"
                    className="nf-btn"
                    onClick={() => navigate(DEFAULT_UNIVERSITY_PATH)}
                >
                    Back to clubs
                </button>
                {/* -1 rather than a second link: whatever they were doing before is a
                    better guess than anywhere we could send them. */}
                <button
                    type="button"
                    className="nf-btn nf-btn--ghost"
                    onClick={() => navigate(-1)}
                >
                    Go back
                </button>
            </div>
        </div>
    );
}
