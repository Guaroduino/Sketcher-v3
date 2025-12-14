import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  // Default to root so builds work when deployed to Firebase Hosting root
  const repoBase = env.VITE_BASE || '/';
  return {
    base: repoBase,
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      // PWA plugin will generate a service worker and manifest at build time.
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Sketcher',
          short_name: 'Sketcher',
          start_url: repoBase,
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#ffffff',
          icons: [
            { src: '/pwa-192.svg', sizes: '192x192', type: 'image/svg+xml' },
            { src: '/pwa-512.svg', sizes: '512x512', type: 'image/svg+xml' }
          ]
        }
      })
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});

