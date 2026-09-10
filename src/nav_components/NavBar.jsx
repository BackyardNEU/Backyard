import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { useGlobalStore } from '../lib/store';
import { apiFetch } from '../lib/api';
import { DEFAULT_UNIVERSITY_PATH } from '../lib/university';
import './NavBar.css';
import calendarActiveIcon from '../assets/Nav_bar_calendar_active.png';
import calendarInactiveIcon from '../assets/Nav_bar_calendar_inactive.png';
import clubsActiveIcon from '../assets/Nav_bar_clubs_active.png';
import clubsInactiveIcon from '../assets/Nav_bar_clubs_inactive.png';

// Global, persistent nav bar: calendar/clubs view switches for UniversityPage,
// plus the login/profile entry point (shares LoginMorph's layoutId="login" so
// the icon-to-card morph animation still plays from this button).
export function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const GlobalValue = useGlobalStore((state) => state.GlobalValue);
  const calendarViewActive = useGlobalStore((state) => state.calendarViewActive);
  const loginOpen = useGlobalStore((state) => state.loginOpen);
  const setLoginOpen = useGlobalStore((state) => state.setLoginOpen);
  const [avatarUrl, setAvatarUrl] = useState(null);
  // Comes back on the profile call below rather than from a separate /admin/is-admin
  // request, which would 403 for all but a handful of accounts on every page load.
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!GlobalValue) { setAvatarUrl(null); setIsAdmin(false); return; }

    // Logging out flips GlobalValue immediately, but a profile request started
    // while signed in can still be in flight and would write the previous
    // user's avatar back onto a signed-out nav bar — and leave it there until
    // the next reload, which matters on a shared machine.
    let active = true;
    apiFetch('/me/profile')
      .then((profile) => {
        if (!active) return;
        setAvatarUrl(profile?.avatar_url ?? null);
        // Strict true: a missing field must read as not-admin rather than truthy junk.
        setIsAdmin(profile?.is_admin === true);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [GlobalValue]);

  const isOnUniPage = location.pathname.startsWith('/university/');

  // UniversityPage owns the calendar/clubs toggle as local state and already
  // listens for this event (also dispatched by its own search bar) — reuse
  // it when already there. From anywhere else, navigate there first and flag
  // the intent via router state, since no listener is mounted yet to catch it.
  const goToUniView = (category) => {
    if (isOnUniPage) {
      window.dispatchEvent(new CustomEvent('backyard-category-select', { detail: { category } }));
    } else {
      navigate(
        DEFAULT_UNIVERSITY_PATH,
        category === 'calendar' ? { state: { openCalendar: true } } : undefined
      );
    }
  };

  const handleProfileClick = () => {
    if (GlobalValue) navigate('/profile');
    else setLoginOpen(true);
  };

  // The login card is a fixed overlay whose dimming comes from a box-shadow
  // rather than a backdrop element, so it darkens these buttons without
  // covering them — on narrow screens the bar sits below the card and stays
  // clickable. Unmount the whole bar, as the old floating cluster did.
  if (loginOpen) return null;

  // Calendar and Clubs describe which view UniversityPage is showing. On any
  // other route neither is current, so claiming a pressed state there would
  // announce a selection the user cannot see.
  const calendarCurrent = isOnUniPage && calendarViewActive;
  const clubsCurrent = isOnUniPage && !calendarViewActive;

  return (
    <nav className="nav-bar">
      <button
        type="button"
        className="nav-bar-btn"
        aria-label="Calendar"
        aria-pressed={calendarCurrent}
        onClick={() => goToUniView('calendar')}
      >
        <img src={calendarCurrent ? calendarActiveIcon : calendarInactiveIcon} alt="" />
      </button>
      <button
        type="button"
        className="nav-bar-btn"
        aria-label="Clubs"
        aria-pressed={clubsCurrent}
        onClick={() => goToUniView('clubs')}
      >
        <img src={clubsCurrent ? clubsActiveIcon : clubsInactiveIcon} alt="" />
      </button>
      {/* Convenience only — /admin is not a secret door. Every admin endpoint is gated
          server side on ADMIN_USER_IDS, and the page itself renders a 404 to anyone who
          is not an admin, so hiding the button is about tidiness rather than access. */}
      {isAdmin && (
        <button
          type="button"
          className="nav-bar-btn nav-bar-admin-btn"
          aria-label="Admin"
          aria-current={location.pathname === '/admin' ? 'page' : undefined}
          onClick={() => navigate('/admin')}
        >
          {/* Inline rather than a new asset: one shape, and it inherits currentColor
              so it tracks the bar instead of needing active/inactive PNG pairs. */}
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M12 2.5 4.5 5.8v5.4c0 4.6 3.2 8.9 7.5 10.3 4.3-1.4 7.5-5.7 7.5-10.3V5.8L12 2.5Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path
              d="m8.6 11.9 2.3 2.3 4.5-4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
      <motion.button
        layoutId="login"
        type="button"
        className="nav-bar-btn nav-bar-profile-btn"
        aria-label={GlobalValue ? 'Profile' : 'Login'}
        onClick={handleProfileClick}
      >
        <img src={avatarUrl || '/raccoon_pfp.png'} alt="" />
      </motion.button>
    </nav>
  );
}

export default NavBar;
