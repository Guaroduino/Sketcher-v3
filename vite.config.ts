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
        // registerType: 'autoUpdate',
        registerType: 'prompt',
        manifest: {
          name: 'Sketcher',
          short_name: 'Sketcher',
          start_url: repoBase,
          display: 'fullscreen',
          orientation: 'any',
          background_color: '#000000',
          theme_color: '#000000',
          icons: [
            { src: '/pwa-192.svg', sizes: '192x192', type: 'image/svg+xml' },
            { src: '/pwa-512.svg', sizes: '512x512', type: 'image/svg+xml' }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY)
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
            'vendor-ai': ['@google/genai'],
            'vendor-react': ['react', 'react-dom'],
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});

