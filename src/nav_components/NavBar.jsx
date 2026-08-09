import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { useGlobalStore } from '../lib/store';
import { apiFetch } from '../lib/api';
import './NavBar.css';
import calendarActiveIcon from '../assets/Nav_bar_calendar_active.png';
import calendarInactiveIcon from '../assets/Nav_bar_calendar_inactive.png';
import clubsActiveIcon from '../assets/Nav_bar_clubs_active.png';
import clubsInactiveIcon from '../assets/Nav_bar_clubs_inactive.png';

// Hardcoded elsewhere in the app too (ProfilePage's close button) — there's
// only one university wired up right now.
const NEU_UNIVERSITY_ID = '38500bfc-e606-46a7-840d-720b11ad2e8b';

// Global, persistent nav bar: calendar/clubs view switches for UniversityPage,
// plus the login/profile entry point (shares LoginMorph's layoutId="login" so
// the icon-to-card morph animation still plays from this button).
export function NavBar({ loginOpen, setLoginOpen }) {
  const navigate = useNavigate();
  const location = useLocation();
  const GlobalValue = useGlobalStore((state) => state.GlobalValue);
  const calendarViewActive = useGlobalStore((state) => state.calendarViewActive);
  const [avatarUrl, setAvatarUrl] = useState(null);

  useEffect(() => {
    if (!GlobalValue) { setAvatarUrl(null); return; }
    apiFetch('/me/profile')
      .then((profile) => setAvatarUrl(profile?.avatar_url))
      .catch(() => {});
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
        `/university/${NEU_UNIVERSITY_ID}`,
        category === 'calendar' ? { state: { openCalendar: true } } : undefined
      );
    }
  };

  const handleProfileClick = () => {
    if (GlobalValue) navigate('/profile');
    else setLoginOpen(true);
  };

  return (
    <nav className="nav-bar">
      <button
        type="button"
        className="nav-bar-btn"
        aria-label="Calendar"
        aria-pressed={calendarViewActive}
        onClick={() => goToUniView('calendar')}
      >
        <img src={calendarViewActive ? calendarActiveIcon : calendarInactiveIcon} alt="" />
      </button>
      <button
        type="button"
        className="nav-bar-btn"
        aria-label="Clubs"
        aria-pressed={!calendarViewActive}
        onClick={() => goToUniView('clubs')}
      >
        <img src={!calendarViewActive ? clubsActiveIcon : clubsInactiveIcon} alt="" />
      </button>
      {!loginOpen && (
        <motion.button
          layoutId="login"
          type="button"
          className="nav-bar-btn nav-bar-profile-btn"
          aria-label={GlobalValue ? 'Profile' : 'Login'}
          onClick={handleProfileClick}
        >
          <img src={avatarUrl || '/raccoon_pfp.png'} alt="" />
        </motion.button>
      )}
    </nav>
  );
}

export default NavBar;
