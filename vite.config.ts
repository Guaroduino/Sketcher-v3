import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
<<<<<<< HEAD
  const repoBase = env.VITE_BASE || '/Sketcher-v3/';
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
          start_url: '/',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#ffffff',
          icons: [
            { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
            { src: '/icon.svg', sizes: '192x192', type: 'image/svg+xml' },
            { src: '/icon.svg', sizes: '512x512', type: 'image/svg+xml' }
          ]
=======
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
        outDir: 'docs',
        emptyOutDir: true,
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
>>>>>>> 0f3b7194c559580e5d40fa0e0803e62a6ac4e706
        }
      })
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    build: {
      outDir: 'docs',
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
