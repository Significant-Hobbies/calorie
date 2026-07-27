import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyTheme, watchSystemTheme } from './lib/theme';
import './styles.css';

applyTheme();
watchSystemTheme();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Service worker registration failed', error);
    });
  });
}

const root = document.getElementById('root');
if (!root) throw new Error('Calorie could not find its app root.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
