import React from 'react';
import ReactDOM from 'react-dom/client';
// FIX: Changed to named import to match the export from App.tsx
import { App } from './App';
// Register service worker for PWA (injected by vite-plugin-pwa)
try {
  // virtual:pwa-register is provided by vite-plugin-pwa at build/dev time
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { registerSW } = require('virtual:pwa-register');
  if (registerSW) registerSW();
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