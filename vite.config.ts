import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//, /^\/ws/],
          runtimeCaching: [
            {
              urlPattern: ({ url }) =>
                url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/api/media/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'motherland-offline-media-v1',
                rangeRequests: true,
                expiration: { maxEntries: 500, maxAgeSeconds: 30 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: ({ url }) =>
                url.pathname === '/api/posts' ||
                url.pathname === '/api/stories' ||
                url.pathname.startsWith('/api/videos/') ||
                url.pathname === '/api/youtube/feed',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'motherland-api-feed-v1',
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 120, maxAgeSeconds: 14 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: ({ url }) =>
                url.hostname === 'i.ytimg.com' || url.hostname === 'yt3.ggpht.com',
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'motherland-offline-media-v1',
                expiration: { maxEntries: 600, maxAgeSeconds: 30 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png'],
        manifest: {
          id: '/',
          name: 'MOTHERLAND — Social Media Super App',
          short_name: 'MOTHERLAND',
          description: 'MOTHERLAND — Sovereign social media platform with unified feeds, Small Videos, Cinema Theater, individual accounts, and YouTube integration.',
          theme_color: '#006A4E',
          background_color: '#006A4E',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        devOptions: {
          enabled: process.env.DISABLE_HMR !== 'true',
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
