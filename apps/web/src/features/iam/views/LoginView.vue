<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BrandMark from '../../../components/ui/BrandMark.vue';
import { BRAND } from '../../../shared/brand.ts';
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
  <div class="login-shell">
    <section class="brand-panel">
      <div class="brand">
        <BrandMark />
        <strong>{{ BRAND.name }}</strong>
      </div>
      <div class="copy">
        <span class="eyebrow">GESTIÓN HOSPITALARIA</span>
        <h1>Cada rol, su propio espacio de trabajo.</h1>
        <p>
          Administrativos, médicos y enfermeros ingresan con su email y ven solo lo que necesitan para
          atender, internar y registrar con seguridad.
        </p>
      </div>
      <p class="foot">{{ BRAND.name }} · {{ BRAND.tagline }}</p>
    </section>

    <section class="form-panel">
      <form class="login-card" @submit.prevent="submit">
        <div>
          <span class="eyebrow dark">ACCESO AL SISTEMA</span>
          <h2>Iniciar sesión</h2>
          <p class="muted">Ingresá con el email de tu cuenta.</p>
        </div>

        <label for="email">
          Email
          <input id="email" v-model="email" type="email" autocomplete="username" placeholder="nombre@hospital.com" required />
        </label>

        <label for="password">
          Contraseña
          <input id="password" v-model="password" type="password" autocomplete="current-password" required />
        </label>

        <p v-if="error" class="field-error" role="alert">{{ error }}</p>

        <button class="btn" type="submit" :disabled="loading">{{ loading ? 'Ingresando...' : 'Ingresar' }}</button>
      </form>
    </section>
  </div>
</template>

<style scoped>
.login-shell { min-height: 100vh; display: grid; grid-template-columns: 44% 56%; background: #fff; }
.brand-panel { position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between;
  padding: 40px 56px; color: #fff;
  background: radial-gradient(circle at 15% 85%, #26897a 0, transparent 27%), linear-gradient(145deg, #0a5147, #073d37); }
.brand-panel::after { content: ''; position: absolute; right: -210px; bottom: -100px; width: 420px; height: 420px; border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.12); box-shadow: 0 0 0 70px rgba(255, 255, 255, 0.025), 0 0 0 140px rgba(255, 255, 255, 0.02); }
.brand { display: flex; align-items: center; gap: 12px; font-family: var(--font-display); font-size: 1.3rem; position: relative; z-index: 1; }
.copy { max-width: 520px; position: relative; z-index: 1; }
.eyebrow { display: block; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.14em; color: #9ed2c8; margin-bottom: 8px; }
.eyebrow.dark { color: var(--color-brand); }
.copy h1 { font-size: clamp(2rem, 3.6vw, 3.2rem); line-height: 1.1; margin: 16px 0 20px; color: #fff; }
.copy p { color: #c8dcd7; font-size: 1.02rem; line-height: 1.6; }
.foot { position: relative; z-index: 1; color: #a7c2bc; font-size: 0.75rem; }
.form-panel { display: grid; place-items: center; padding: 48px; }
.login-card { width: min(420px, 100%); display: grid; gap: 18px; }
.login-card h2 { font-size: 1.9rem; margin: 4px 0; }

@media (max-width: 900px) {
  .login-shell { grid-template-columns: 1fr; }
  .brand-panel { display: none; }
}
@media (max-width: 620px) {
  .form-panel { padding: 24px 16px; }
}
</style>
