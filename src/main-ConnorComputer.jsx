import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
//import { GoogleOAuthProvider } from "@react-oauth/google";

//const clientId = "856146216508-2sjn2p31ppaikvl9l9tasooiotote82e.apps.googleusercontent.com";

ReactDOM.createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)

//to do:
//add an embedded table into the app-
//  overtable (contains info on universities and reference to sub table) -> subtable (uni club info)
