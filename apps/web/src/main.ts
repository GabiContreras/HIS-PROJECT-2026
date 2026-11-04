import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './app/router';
import { configureAuth } from './shared/http';
import { useSessionStore } from './features/iam/session.store';
import './shared/styles/tokens.css';
import './shared/styles/base.css';

const pinia = createPinia();
const app = createApp(App);
app.use(pinia);

const session = useSessionStore(pinia);
configureAuth({
  refresh: session.refreshSession,
  onSessionExpired: () => {
    session.clear();
    void router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } });
  },
});

app.use(router);
app.mount('#app');