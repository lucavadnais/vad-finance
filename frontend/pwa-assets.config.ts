import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// The app's icons (favicon, home screen, Android maskable), generated from the
// logo by vite-plugin-pwa at each build and served by the dev server
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    // The logo is full-bleed already: no padding, keep its night background
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#010318' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#010318' } },
  },
  images: ['public/logo.svg'],
});
