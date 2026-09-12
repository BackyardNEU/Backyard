import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import './App.css';
import { SearchBar } from './home_components/SearchBar';
import { UniversityPage } from './uni_components/UniversityPage';
import LoginMorph from "./login_components/LoginMorph";
import { NavBar } from "./nav_components/NavBar";
import ReviewPage from "./review_components/ReviewPage";
import AuthListener from "./login_components/AuthListener";
import AuthCallbackPage from './login_components/AuthCallbackPage';
import ProfileSetupPage from './profile_components/ProfileSetupPage';
import SettingsPage from './settings_components/SettingsPage';
import { ProfilePage } from './profile_components/ProfilePage';
import { FriendProfile } from './profile_components/FriendProfile';
import ResetPasswordPage from './login_components/ResetPasswordPage';
import JoinPage from './join_components/JoinPage';
import { ClubDataProvider } from './context/ClubDataProvider'
import { SupportModal } from './support_components/SupportModal'
import { DEFAULT_UNIVERSITY_PATH } from './lib/university'
import NotFoundPage from './components/NotFoundPage'
import { useGlobalStore } from './lib/store'
import { Analytics } from '@vercel/analytics/react'

// Split out so the admin UI is not in the bundle every visitor downloads. It shipped
// there as a static import, which meant anyone could read the admin screens and the
// endpoints they call — and made the 404 below fairly hollow, since the code
// announcing /admin was sitting in the same file that was hiding it.
const AdminPage = lazy(() => import('./admin_components/AdminPage'));

function App() {
  const loginOpen = useGlobalStore((s) => s.loginOpen);
  const setLoginOpen = useGlobalStore((s) => s.setLoginOpen);
  const supportOpen = useGlobalStore((state) => state.supportOpen);
  const setSupportOpen = useGlobalStore((state) => state.setSupportOpen);
  const location = useLocation();

  useEffect(() => {
    // Close the login modal whenever navigation occurs (back/forward or route changes).
    setLoginOpen(false);
  }, [location]);

  // research why /:id doesn't work for da code
  return (
    // Club data provider allows the cached supabase data to be used anywhere throughout these components
    <ClubDataProvider>
      <div className="App">
          <AuthListener />
          <LoginMorph open={loginOpen} setOpen={setLoginOpen} />
          <NavBar />
          <SupportModal open={supportOpen} setOpen={setSupportOpen} />

        <Routes>
          {/* University selection disabled — defaulting to Northeastern for now */}
          <Route
            path="/"
            element={<Navigate to={DEFAULT_UNIVERSITY_PATH} replace />}
          />
          <Route path="/university/:id" element={<UniversityPage />} />
          <Route path="/reviews/:id" element={<ReviewPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/friend/:id" element={<FriendProfile />} />
          <Route path="/profile/setup" element={<ProfileSetupPage />} />
          <Route path="/profile-setup" element={<ProfileSetupPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/join/:token" element={<JoinPage />} />
          <Route
            path="/admin"
            element={(
              // No fallback UI: AdminPage renders its own "checking access" state, and a
              // spinner here would flash on every load for the one person who is an admin.
              <Suspense fallback={null}>
                <AdminPage />
              </Suspense>
            )}
          />
          {/* Must be last. Without it an unmatched path rendered nothing at all —
              a blank page rather than a 404, which is what people were hitting. */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Analytics />
      </div>
    </ClubDataProvider>
  );
}

export default App
//small implementation test