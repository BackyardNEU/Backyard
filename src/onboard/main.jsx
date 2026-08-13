import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import OnboardApp from './OnboardApp.jsx';
import './onboard.css';

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <OnboardApp />
    </StrictMode>
);
