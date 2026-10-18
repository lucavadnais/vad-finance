import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import { trackKeyboardInset } from './composables/useKeyboardInset';
import './index.css';

trackKeyboardInset();
createApp(App).use(router).mount('#app');
