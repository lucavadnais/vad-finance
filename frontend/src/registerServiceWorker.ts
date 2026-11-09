// The service worker keeping the app installable and quick to open (vite.config.ts).
// A browser only looks for a new version when a page is loaded, and an installed
// app resumed from the background is not reloaded: some users kept an old
// version for days. So it is also checked each time the app comes back to the
// screen; a new one found takes over and the page reloads on it at once
// (registerType 'autoUpdate'), as the user just came back to it.
import { registerSW } from 'virtual:pwa-register';

export function registerServiceWorker() {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) registration.update().catch(() => {});
      });
    },
  });
}
