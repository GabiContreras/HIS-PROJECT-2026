<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { useSessionStore } from '../features/iam/session.store';
import { ROLE_LABELS, type Role } from '../features/iam/types';
import RoleChip from '../components/ui/RoleChip.vue';

interface MenuItem {
  to: string;
  label: string;
  roles?: Role[];
}

const allItems: MenuItem[] = [
  { to: '/', label: 'Panel' },
  { to: '/turnos', label: 'Turnos', roles: ['MEDICO', 'ADMINISTRATIVO'] },
  { to: '/pacientes', label: 'Pacientes' },
  { to: '/camas', label: 'Camas' },
  { to: '/enfermeria', label: 'Enfermería', roles: ['ENFERMERO', 'MEDICO'] },
  { to: '/insumos', label: 'Insumos', roles: ['ENFERMERO', 'ADMINISTRATIVO'] },
  { to: '/facturacion', label: 'Facturación', roles: ['ADMINISTRATIVO'] },
  { to: '/usuarios', label: 'Usuarios', roles: ['ADMINISTRATIVO'] },
];

const session = useSessionStore();
const router = useRouter();
const route = useRoute();

const open = ref(false);
const query = ref('');

const menu = computed(() =>
  allItems.filter((item) => !item.roles || (session.role !== null && item.roles.includes(session.role))),
);

watch(() => route.fullPath, () => { open.value = false; });

function search(): void {
  void router.push({ name: 'patients', query: query.value ? { q: query.value } : {} });
}

async function logout(): Promise<void> {
  await session.logout();
  await router.push({ name: 'login' });
}
</script>

<template>
  <div class="shell">
    <div v-show="open" class="backdrop" @click="open = false"></div>

    <aside class="sidebar" :class="{ open }">
      <div class="brand">HIS</div>
      <nav>
        <RouterLink v-for="item in menu" :key="item.to" :to="item.to" class="nav-link">
          {{ item.label }}
        </RouterLink>
      </nav>
      <button class="logout" type="button" @click="logout">Cerrar sesión</button>
    </aside>

    <div class="main">
      <header class="topbar">
        <button class="burger" type="button" aria-label="Abrir menú" @click="open = !open">☰</button>
        <form class="search" @submit.prevent="search">
          <input v-model="query" type="search" placeholder="Buscar paciente..." />
        </form>
        <button class="bell" type="button" aria-label="Notificaciones">🔔</button>
        <span class="user-name">{{ session.fullName }}</span>
        <RoleChip v-if="session.role" :role="ROLE_LABELS[session.role] as 'Médico' | 'Enfermero' | 'Administrativo'" />
      </header>
      <main class="content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.shell { display: flex; min-height: 100vh; }
.sidebar { width: 220px; flex-shrink: 0; background: var(--color-primary); color: #fff; padding: var(--space-3);
  display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; }
.brand { font-weight: 700; font-size: 1.4rem; margin-bottom: var(--space-4); }
nav { flex: 1; overflow-y: auto; }
.nav-link { display: block; color: #dbe6f5; text-decoration: none; padding: var(--space-2) var(--space-3);
  border-radius: 8px; margin-bottom: var(--space-1); }
.nav-link:hover { background: rgba(255, 255, 255, 0.08); }
.nav-link.router-link-exact-active { background: rgba(255, 255, 255, 0.15); color: #fff; }
.logout { border: 1px solid rgba(255, 255, 255, 0.4); background: transparent; color: #fff; border-radius: 8px;
  padding: 8px 12px; font: inherit; cursor: pointer; }
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.topbar { display: flex; align-items: center; gap: var(--space-3); background: var(--color-surface);
  border-bottom: 1px solid var(--color-border); padding: var(--space-3) var(--space-4); }
.search { flex: 1; max-width: 420px; }
.search input { width: 100%; font: inherit; padding: 8px 12px; border: 1px solid var(--color-border); border-radius: 8px; }
.bell, .burger { border: 1px solid var(--color-border); background: transparent; border-radius: 8px;
  padding: 6px 10px; font: inherit; cursor: pointer; }
.burger { display: none; }
.user-name { font-weight: 600; margin-left: auto; white-space: nowrap; }
.chip { background: #e6eefb; color: var(--color-primary); padding: 2px 10px; border-radius: 999px; font-size: 0.8rem; }
.content { padding: var(--space-4); min-width: 0; }
.backdrop { display: none; }

@media (max-width: 900px) {
  .burger { display: inline-block; }
  .sidebar { position: fixed; z-index: 30; inset: 0 auto 0 0; transform: translateX(-100%); transition: transform 0.2s; }
  .sidebar.open { transform: translateX(0); }
  .backdrop { display: block; position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45); z-index: 20; }
  .topbar { padding: var(--space-2) var(--space-3); gap: var(--space-2); }
  .user-name { display: none; }
  .search { max-width: none; }
  .content { padding: var(--space-3); }
}
</style>