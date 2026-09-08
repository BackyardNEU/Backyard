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

  useEffect(() => {
    if (!GlobalValue) { setAvatarUrl(null); return; }

    // Logging out flips GlobalValue immediately, but a profile request started
    // while signed in can still be in flight and would write the previous
    // user's avatar back onto a signed-out nav bar — and leave it there until
    // the next reload, which matters on a shared machine.
    let active = true;
    apiFetch('/me/profile')
      .then((profile) => { if (active) setAvatarUrl(profile?.avatar_url ?? null); })
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
