import { Routes, Route, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import './App.css';
import { SearchBar } from './home_components/SearchBar';
import { UniversityPage } from './uni_components/UniversityPage';
import LoginMorph from "./login_components/LoginMorph";
import ReviewPage from "./review_components/ReviewPage";
import AuthListener from "./login_components/AuthListener";
import AuthCallbackPage from './login_components/AuthCallbackPage';
import ProfileSetupPage from './profile_components/ProfileSetupPage';
import { ProfilePage } from './profile_components/ProfilePage';
import ResetPasswordPage from './login_components/ResetPasswordPage';
import JoinPage from './join_components/JoinPage';
import AdminPage from './admin_components/AdminPage';
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
          <Route
            path="/"
            element={
              
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
  {/* Responsive Video Container */}
  <div style={{
    width: '100%',
    marginTop: '-40px',
    maxWidth: '1100px',
    marginLeft: 'auto',
    marginRight: 'auto',
    overflow: 'hidden',
  }}>
    <video 
      src={`/src/assets/intro_screen.mp4`} 
      autoPlay 
      muted 
      playsInline 
      loop
      style={{ 
        width: '90%',
        maxWidth: '1100px',
        height: 'auto',
        objectFit: 'cover', // Ensures no black bars, fills the container
        display: 'block',
        zIndex: 1,

      }}
    />
  </div>

  {/* Search Bar Container */}
  <div className="search-bar-container" style={{ width: '100%', padding: '1rem' }}>
    <SearchBar />
  </div>
</div>
            }
          />
          <Route path="/university/:id" element={<UniversityPage />} />
          <Route path="/reviews/:id" element={<ReviewPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/setup" element={<ProfileSetupPage />} />
          <Route path="/profile-setup" element={<ProfileSetupPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/join/:token" element={<JoinPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </div>
    </ClubDataProvider>
  );
}

export default App