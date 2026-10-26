import { polyfillCountryFlagEmojis } from 'country-flag-emoji-polyfill';
import flagFont from 'country-flag-emoji-polyfill/dist/TwemojiCountryFlags.woff2?url';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

// Windows has no flag emoji font; load a small self-hosted one only where flags would show as letters
polyfillCountryFlagEmojis('Twemoji Country Flags', flagFont);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
