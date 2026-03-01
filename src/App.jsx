import { Routes, Route, useNavigate} from 'react-router-dom'
import { useState } from 'react'
import './App.css'
import { SearchBar } from './components/SearchBar'
import { SearchResultsList } from './components/SearchResultsList'
import { UniversityPage } from './uni_components/UniversityPage'
import LoginMorph from "./login_components/LoginMorph"
import ReviewPage from "./review_components/ReviewPage"
import AuthListener from "./login_components/AuthListener"

function App() {
  const [results, setResults] = useState([])
  const [loginOpen, setLoginOpen] = useState(false);
  //research why /:id doesn't work for da code
  return (
    <div className="App">

        <AuthListener/>
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
      </Routes>
    </div>
  );
}

export default App