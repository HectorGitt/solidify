import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

/**
 * The .slfy reference viewer, built on its own (no app, no service worker) into format/www/viewer, which is
 * published with the format's website (slfy.solidify.studio/viewer/).
 *   npx vite build --config vite.viewer.config.ts
 */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  publicDir: false,
  define: { __BUILD_ID__: JSON.stringify(`viewer-${Date.now().toString(36)}`) },
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    target: 'es2022',
    outDir: fileURLToPath(new URL('../format/www', import.meta.url)),
    // only viewer/ is the build's (cleared before building); img/ beside it holds the examples' pictures
    emptyOutDir: false,
    assetsDir: 'viewer/assets',
    chunkSizeWarningLimit: 4000,
    rollupOptions: { input: fileURLToPath(new URL('./viewer/index.html', import.meta.url)) },
  },
})
