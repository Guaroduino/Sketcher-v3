import React from 'react';
import ReactDOM from 'react-dom/client';
// FIX: Changed to named import to match the export from App.tsx
import { App } from './App';
// Register service worker for PWA (injected by vite-plugin-pwa)
try {
  // virtual:pwa-register is provided by vite-plugin-pwa at build/dev time.
  // Use a dynamic ESM import so this only runs in the browser and avoids
  // relying on CommonJS `require` (which can be problematic in some setups).
  // If you plan to publish the PWA, add the referenced icons (pwa-192.png,
  // pwa-512.png) into a `public/` folder so the manifest can find them.
  void import('virtual:pwa-register')
    .then(({ registerSW }) => {
      if (typeof registerSW === 'function') registerSW();
    })
    .catch(() => {
      // plugin not installed or running in an environment without the virtual module
    });
} catch (e) {
  // plugin not installed or running in an environment without the virtual module
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);