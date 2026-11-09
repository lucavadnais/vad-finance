import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import { trackKeyboardInset } from './composables/useKeyboardInset';
import { registerServiceWorker } from './registerServiceWorker';
import './index.css';

trackKeyboardInset();
createApp(App).use(router).mount('#app');
registerServiceWorker();
