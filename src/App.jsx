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
              <div className="search-bar-container">
              <h2 className="ra">
                Back
                <span className="raccoon-wrapper">
                <img src="/raccoon.png" alt="raccoon" className="raccoon-icon" />
                </span>
                <span className="ra">     yard</span>
                </h2>
                <SearchBar setResults={setResults} />
                <SearchResultsList results={results} />
              </div>
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