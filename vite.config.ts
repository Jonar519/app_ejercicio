import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

const DAY_SECONDS = 86_400;
const THEME_COLOR = '#047857';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'App Ejercicio',
        short_name: 'Ejercicio',
        description: 'Programa de entrenamiento de 31 días y registro de nutrición.',
        lang: 'es',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'portrait',
        theme_color: THEME_COLOR,
        background_color: '#fafafa',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Las URL incluyen el user_id; `clearLocalData` borra esta caché al cerrar sesión.
            urlPattern: ({ url, request }) =>
              url.pathname.startsWith('/rest/v1/') && request.method === 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 100, maxAgeSeconds: DAY_SECONDS },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin && ['image', 'font', 'style', 'script'].includes(request.destination),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-cache',
              expiration: { maxEntries: 60, maxAgeSeconds: 30 * DAY_SECONDS },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['src/integration/**', 'node_modules/**'],
  },
});
