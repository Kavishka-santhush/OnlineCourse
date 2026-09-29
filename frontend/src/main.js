import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { vMotion } from '@vueuse/motion';

import App from './App.vue';
import { router } from './router';
import { useAuthStore } from './stores/auth.js';
import { useUiStore } from './stores/ui.js';
import './assets/main.css';

const app = createApp(App);

app.use(createPinia());
app.directive('motion', vMotion);   // @vueuse/motion — `v-motion` on any element
app.use(router);

// Apply persisted theme + boot Clerk/auth before first paint.
const ui = useUiStore();
ui.applyTheme();

const auth = useAuthStore();
auth.boot().finally(() => {
  app.mount('#app');
});
