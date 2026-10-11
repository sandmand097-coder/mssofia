import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import App from './App.jsx';
import './styles.css';
import './portal.css';
import './brand.css';
import './science-discovery.css';
import './whatsapp-contact.css';
import './getting-started-guide.css';
import './live-lesson-walkthrough.css';

// Opt out of native bottom-of-page scroll restoration on a hard refresh.
if('scrollRestoration' in window.history)window.history.scrollRestoration='manual';
createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter><App/></BrowserRouter></React.StrictMode>);
