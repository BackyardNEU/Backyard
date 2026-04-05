import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import './App.css';
import { SearchBar } from './components/SearchBar';
import { SearchResultsList } from './components/SearchResultsList';
import { UniversityPage } from './uni_components/UniversityPage';
import LoginMorph from "./login_components/LoginMorph";
import ReviewPage from "./review_components/ReviewPage";
import AuthListener from "./login_components/AuthListener";
import { ProfilePage } from './profile_components/ProfilePage';
import { ClubDataProvider } from './context/ClubDataProvider'

function App() {
  const [results, setResults] = useState([])
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
              <>
              <div style={{ width: '100%', height: '100vh', overflow: 'hidden', zIndex: 1000}}>
      <video 
        src={`/src/assets/intro_screen.mp4`} 
        autoPlay 
        
        muted 
        playsInline 
        style={{ 
          width: '100%', 
          height: '100%', 
          objectFit: 'cover' // Fills the screen without stretching
        }}
      />
    </div>
              <div className="search-bar-container">
             
                <SearchBar setResults={setResults} />
                <SearchResultsList results={results} />
              </div>
            
            </>
            }
          />
          <Route path="/university/:id" element={<UniversityPage />} />
          <Route path="/reviews/:id" element={<ReviewPage />} />
           <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </div>
    </ClubDataProvider>
  );
}

export default App