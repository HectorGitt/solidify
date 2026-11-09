/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

/** this build's id: open tabs compare it with version.json to notice a newer deploy */
const BUILD_ID = Date.now().toString(36)

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'solidify-version',
      apply: 'build',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) })
      },
    },
    // installable app: a manifest, and a service worker that keeps the app's code for offline use. Pages come
    // from the network first (a deploy is seen at once; the cache is only for when there is no connection);
    // the API is never cached. A new worker takes over quietly: it never reloads the page by itself (a build
    // in progress would be lost); the "new version" notice (appUpdate.ts) still asks first.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'Solidify',
        short_name: 'Solidify',
        description: 'Engineering in 3D: working lab rigs, models built from your words or photos, notes and questions in 3D.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0c110f',
        theme_color: '#0c110f',
        categories: ['education'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // only the opening page's own files up front (the whole app is 8 MB, too much to fetch in the
        // background on a phone); every other file is kept the first time it is used, below
        globPatterns: ['assets/index-*.js', 'assets/*.css', 'favicon.svg', 'icons/*.png'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'pages', networkTimeoutSeconds: 4, expiration: { maxEntries: 4 } },
          },
          {
            // the app's code and fonts: named by their content, so a kept copy is never out of date
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.includes('/assets/'),
            handler: 'CacheFirst',
            options: { cacheName: 'code', expiration: { maxEntries: 400, maxAgeSeconds: 30 * 24 * 3600 } },
          },
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /\/(media|models)\//.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'media', expiration: { maxEntries: 300, maxAgeSeconds: 30 * 24 * 3600 } },
          },
        ],
      },
    }),
  ],
  base: './',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 30000,
    maxWorkers: 4,
  },
})
