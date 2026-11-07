import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const ARKA_BUILD_VERSION = '5.5.0';

// Ensure any stale Service Worker or Cache Storage from previous Tauri/WebView2 builds is immediately purged
try {
  const prevVersion = localStorage.getItem('ARKA_INSTALLED_BUILD_VERSION');
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister();
      }
    }).catch(() => {});
  }
  if (prevVersion !== ARKA_BUILD_VERSION) {
    localStorage.setItem('ARKA_INSTALLED_BUILD_VERSION', ARKA_BUILD_VERSION);
    if (typeof window !== 'undefined' && 'caches' in window) {
      caches.keys().then((keys) => {
        for (const key of keys) {
          caches.delete(key);
        }
      }).catch(() => {});
    }
  }
} catch {
  // Ignore storage access errors
}

createRoot(document.getElementById('root')!).render(<App />);
