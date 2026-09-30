import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
const AbilityPreview = React.lazy(() => import('./babylon/AbilityPreview'));
const showAbilityPreview = process.env.REACT_APP_ABILITY_PREVIEW === 'true' && window.location.pathname === '/ability-preview';
root.render(
  <React.StrictMode>
    {showAbilityPreview ? <React.Suspense fallback={<p>Loading ability preview…</p>}><AbilityPreview /></React.Suspense> : <App />}
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
