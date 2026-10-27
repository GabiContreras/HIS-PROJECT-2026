<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSessionStore } from '../session.store.ts';
import { ApiError } from '../../../shared/http.ts';

const session = useSessionStore();
const router = useRouter();
const route = useRoute();

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

function destination(): string {
  const redirect = route.query.redirect;
  if (typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')) {
    return redirect;
  }
  return '/';
}

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    await session.login(email.value.trim(), password.value);
    await router.push(destination());
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Ocurrió un error inesperado.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login">
    <form class="card" @submit.prevent="submit">
      <h1>HIS</h1>
      <p class="muted">Ingresá con tu cuenta</p>

      <label for="email">Email</label>
      <input id="email" v-model="email" type="email" autocomplete="username" required />

      <label for="password">Contraseña</label>
      <input id="password" v-model="password" type="password" autocomplete="current-password" required />

      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <button type="submit" :disabled="loading">{{ loading ? 'Ingresando...' : 'Ingresar' }}</button>
    </form>
  </div>
</template>

<style scoped>
.login { min-height: 100vh; display: grid; place-items: center; padding: var(--space-3); }
.card { width: 100%; max-width: 360px; background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius); padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); }
h1 { margin: 0; color: var(--color-primary); }
.muted { margin: 0 0 var(--space-3); color: var(--color-muted); }
label { font-size: 0.9rem; font-weight: 600; }
input { padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 8px; font: inherit; }
input:focus { outline: 2px solid var(--color-accent); outline-offset: 1px; }
.error { margin: 0; color: var(--color-danger); font-size: 0.9rem; }
button { margin-top: var(--space-2); padding: 10px 12px; border: 0; border-radius: 8px; font: inherit;
  font-weight: 600; background: var(--color-primary); color: #fff; cursor: pointer; }
button:disabled { opacity: 0.6; cursor: not-allowed; }
</style>