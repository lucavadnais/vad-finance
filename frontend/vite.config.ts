import path from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    vue(),
    // The DevTools widget at the bottom of the page, in dev only. Its inspector
    // opens the clicked element's file in VS Code through the script
    vueDevTools({ launchEditor: path.resolve(import.meta.dirname, '../.devcontainer/open-in-vscode.sh') }),
    tailwindcss(),
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
