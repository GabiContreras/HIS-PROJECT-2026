<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import RoleChip from '../components/ui/RoleChip.vue';
import { useSessionStore } from '../features/iam/session.store';
import type { Role } from '../features/iam/types';
import { useNotificationsStore } from '../stores/notifications.store';

interface MenuItem {
  to: string;
  label: string;
  roles?: Role[];
}

const allItems: MenuItem[] = [
  { to: '/', label: 'Panel' },
  { to: '/turnos', label: 'Turnos', roles: ['MEDICO', 'ADMINISTRATIVO'] },
  { to: '/pacientes', label: 'Pacientes' },
  { to: '/triaje', label: 'Triaje', roles: ['ENFERMERO', 'MEDICO'] },
  { to: '/camas', label: 'Camas' },
  { to: '/enfermeria', label: 'Enfermería', roles: ['ENFERMERO', 'MEDICO'] },
  { to: '/insumos', label: 'Insumos', roles: ['ENFERMERO', 'ADMINISTRATIVO'] },
  { to: '/facturacion', label: 'Facturación', roles: ['ADMINISTRATIVO'] },
  { to: '/usuarios', label: 'Usuarios', roles: ['ADMINISTRATIVO'] },
];

const session = useSessionStore();
const notifications = useNotificationsStore();
const router = useRouter();
const route = useRoute();

const menuOpen = ref(false);
const bellOpen = ref(false);
const query = ref('');

const menu = computed(() =>
  allItems.filter((item) => !item.roles || (session.role !== null && item.roles.includes(session.role))),
);
const initials = computed(() =>
  `${session.account?.nombre.charAt(0) ?? ''}${session.account?.apellido.charAt(0) ?? ''}`.toUpperCase(),
);
const title = computed(() => String(route.meta.title ?? 'HIS'));

watch(() => route.fullPath, () => {
  menuOpen.value = false;
  bellOpen.value = false;
});

function search(): void {
  void router.push({ name: 'patients', query: query.value.trim() ? { q: query.value.trim() } : {} });
}

function toggleBell(): void {
  bellOpen.value = !bellOpen.value;
  if (!bellOpen.value) notifications.markAllRead();
}

async function logout(): Promise<void> {
  await session.logout();
  await router.push({ name: 'login' });
}
</script>

<template>
  <div class="shell">
    <div v-show="menuOpen" class="backdrop" @click="menuOpen = false"></div>

    <aside class="sidebar" :class="{ open: menuOpen }">
      <div class="brand">
        <span class="brand-mark">H</span>
        <span>
          <strong>HIS</strong>
          <small>Gestión hospitalaria</small>
        </span>
      </div>
      <p class="caption">MÓDULOS</p>
      <nav aria-label="Módulos">
        <RouterLink v-for="item in menu" :key="item.to" :to="item.to" class="nav-link">{{ item.label }}</RouterLink>
      </nav>
      <div class="side-note">
        <span>SESIÓN</span>
        <strong>{{ session.fullName }}</strong>
        <p>{{ session.account?.email }}</p>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <button class="burger" type="button" aria-label="Abrir menú" @click="menuOpen = !menuOpen">☰</button>
        <div class="heading">
          <small>HIS</small>
          <h1>{{ title }}</h1>
        </div>
        <form class="search" role="search" @submit.prevent="search">
          <input v-model="query" type="search" placeholder="Buscar paciente..." aria-label="Buscar paciente" />
        </form>

        <div class="bell-wrap">
          <button class="bell" type="button" aria-label="Notificaciones" @click="toggleBell">
            🔔<span v-if="notifications.unread > 0" class="count">{{ notifications.unread }}</span>
          </button>
          <div v-if="bellOpen" class="bell-panel" role="region" aria-label="Notificaciones">
            <p v-if="notifications.visible.length === 0" class="muted empty">Sin notificaciones.</p>
            <ul v-else>
              <li v-for="n in notifications.visible" :key="n.id" :class="`lv-${n.level}`">
                <strong>{{ n.title }}</strong>
                <span>{{ n.detail }}</span>
              </li>
            </ul>
          </div>
        </div>

        <div class="user">
          <span class="avatar" aria-hidden="true">{{ initials }}</span>
          <div class="who">
            <strong>{{ session.fullName }}</strong>
            <RoleChip v-if="session.role" :role="session.role" />
          </div>
          <button class="logout" type="button" @click="logout">Salir</button>
        </div>
      </header>

      <main class="content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.shell { min-height: 100vh; display: flex; }
.sidebar { width: 248px; flex-shrink: 0; position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column;
  padding: 24px 18px; background: #0b3f38; color: #fff; }
.brand { display: flex; align-items: center; gap: 12px; padding: 0 8px 26px; font-family: var(--font-display); }
.brand-mark { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 9px; background: #fff;
  color: var(--color-brand); font-weight: 700; font-size: 1.2rem; }
.brand strong { display: block; font-size: 1.1rem; line-height: 1.1; }
.brand small { color: #9ed2c8; font-size: 0.68rem; font-family: var(--font); }
.caption { font-size: 0.6rem; letter-spacing: 0.13em; color: #8eb2aa; margin: 4px 10px 8px; }
nav { display: grid; gap: 4px; overflow-y: auto; }
.nav-link { color: #bed1cd; padding: 11px 12px; border-radius: 7px; font-size: 0.86rem; font-weight: 500; }
.nav-link:hover { background: rgba(255, 255, 255, 0.08); color: #fff; text-decoration: none; }
.nav-link.router-link-exact-active, .nav-link.router-link-active:not([href='/']) { background: rgba(255, 255, 255, 0.13); color: #fff; }
.side-note { margin-top: auto; border-top: 1px solid rgba(255, 255, 255, 0.12); padding: 16px 8px 0; display: grid; gap: 3px; }
.side-note span { font-size: 0.6rem; letter-spacing: 0.13em; color: #8eb2aa; }
.side-note strong { font-size: 0.82rem; }
.side-note p { color: #99b7b1; font-size: 0.72rem; overflow-wrap: anywhere; }

.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.topbar { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 16px; min-height: 76px;
  padding: 12px 28px; background: #fff; border-bottom: 1px solid var(--color-line); }
.heading small { display: block; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.14em; color: var(--color-brand); }
.heading h1 { font-size: 1.3rem; }
.search { flex: 1; max-width: 380px; margin-left: auto; }
.search input { background: var(--color-bg); }
.bell-wrap { position: relative; }
.bell { position: relative; padding: 7px 10px; background: #fff; }
.count { position: absolute; top: -6px; right: -6px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 99px;
  background: var(--color-danger); color: #fff; font-size: 0.65rem; line-height: 18px; text-align: center; }
.bell-panel { position: absolute; right: 0; top: calc(100% + 8px); width: 320px; max-height: 360px; overflow-y: auto; z-index: 10;
  background: #fff; border: 1px solid var(--color-line); border-radius: 10px; box-shadow: 0 10px 30px rgba(14, 45, 38, 0.15); }
.bell-panel ul { list-style: none; margin: 0; padding: 0; }
.bell-panel li { display: grid; gap: 2px; padding: 12px 14px; border-bottom: 1px solid var(--color-line); font-size: 0.82rem; border-left: 4px solid var(--color-info); }
.bell-panel li:last-child { border-bottom: 0; }
.lv-critical { border-left-color: var(--color-danger) !important; background: var(--color-danger-soft); }
.lv-warning { border-left-color: #d49a2e !important; }
.empty { padding: 16px; }
.user { display: flex; align-items: center; gap: 10px; }
.avatar { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 50%; font-size: 0.75rem; font-weight: 700;
  color: var(--color-brand); background: var(--color-brand-soft); }
.who { display: grid; gap: 2px; justify-items: start; }
.who strong { font-size: 0.8rem; line-height: 1.1; }
.logout { border: 0; border-left: 1px solid var(--color-line); border-radius: 0; background: transparent; margin-left: 4px; padding: 6px 4px 6px 14px;
  font-size: 0.8rem; color: var(--color-muted); }
.content { padding: 28px; width: 100%; max-width: 1280px; margin: 0 auto; }
.burger { display: none; padding: 6px 10px; }
.backdrop { display: none; }

@media (max-width: 900px) {
  .burger { display: inline-block; }
  .sidebar { position: fixed; inset: 0 auto 0 0; z-index: 30; transform: translateX(-100%); transition: transform 0.2s; }
  .sidebar.open { transform: translateX(0); }
  .backdrop { display: block; position: fixed; inset: 0; z-index: 20; background: rgba(0, 0, 0, 0.45); }
  .topbar { padding: 10px 16px; gap: 10px; flex-wrap: wrap; }
  .search { order: 5; max-width: none; flex-basis: 100%; margin-left: 0; }
  .heading { margin-right: auto; }
  .who strong { display: none; }
  .content { padding: 16px; }
}
</style>
