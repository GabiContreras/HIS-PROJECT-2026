import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './app/Router';
import './shared/styles/tokens.css';
import './shared/styles/base.css';

createApp(App).use(createPinia()).use(router).mount('#app');