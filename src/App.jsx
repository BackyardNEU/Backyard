import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import './App.css';
import HomePage from './home_components/HomePage';
import { UniversityPage } from './uni_components/UniversityPage';
import LoginMorph from "./login_components/LoginMorph";
import ReviewPage from "./review_components/ReviewPage";
import AuthListener from "./login_components/AuthListener";
import AuthCallbackPage from './login_components/AuthCallbackPage';
import ProfileSetupPage from './profile_components/ProfileSetupPage';
import { ProfilePage } from './profile_components/ProfilePage';
import { FriendProfile } from './profile_components/FriendProfile';
import ResetPasswordPage from './login_components/ResetPasswordPage';
import { ClubDataProvider } from './context/ClubDataProvider'

function App() {
  const [loginOpen, setLoginOpen] = useState(false);
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

        <Routes>
          <Route path="/" element={<HomePage onOpenLogin={() => setLoginOpen(true)} />} />
          <Route path="/university/:id" element={<UniversityPage />} />
          <Route path="/reviews/:id" element={<ReviewPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/friend/:id" element={<FriendProfile />} />
          <Route path="/profile/setup" element={<ProfileSetupPage />} />
          <Route path="/profile-setup" element={<ProfileSetupPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </div>
    </ClubDataProvider>
  );
}

export default App