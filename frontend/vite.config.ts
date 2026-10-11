import path from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    vue(),
    // The DevTools widget at the bottom of the page, in dev only. Its inspector
    // opens the clicked element's file in VS Code through the script
    vueDevTools({ launchEditor: path.resolve(import.meta.dirname, '../.devcontainer/open-in-vscode.sh') }),
    tailwindcss(),
    // Installable web app: manifest, icons (pwa-assets.config.ts) and a service
    // worker that caches the app itself, never the API's data. Active in builds
    // only (npm run build, then npm run preview)
    VitePWA({
      registerType: 'autoUpdate',
      pwaAssets: { config: true },
      manifest: {
        name: 'VAD finances',
        short_name: 'Finances',
        description: 'Gestion de vos finances personnelles',
        lang: 'fr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f5f5f8',
        theme_color: '#f5f5f8',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Every page address opens the app, except the API's
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    host: true,
    port: 5173,
    // File watching through a Docker bind mount on Windows needs polling
    watch: { usePolling: true },
    proxy: {
      '/api': process.env.API_TARGET || 'http://localhost:3000',
    },
  },
});
