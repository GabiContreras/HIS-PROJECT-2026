<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, RouterView, useRouter } from 'vue-router';
import { useSessionStore } from '../features/iam/session.store';
import { ROLE_LABELS, type Role } from '../features/iam/types';

interface MenuItem {
  to: string;
  label: string;
  roles?: Role[];
}

const allItems: MenuItem[] = [
  { to: '/', label: 'Panel' },
  { to: '/usuarios', label: 'Usuarios', roles: ['ADMINISTRATIVO'] },
  { to: '/turnos', label: 'Turnos', roles: ['MEDICO', 'ADMINISTRATIVO'] },
];

const session = useSessionStore();
const router = useRouter();

const menu = computed(() =>
  allItems.filter((item) => !item.roles || (session.role !== null && item.roles.includes(session.role))),
);

async function logout() {
  await session.logout();
  await router.push({ name: 'login' });
}
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">HIS</div>
      <nav>
        <RouterLink v-for="item in menu" :key="item.to" :to="item.to" class="nav-link">
          {{ item.label }}
        </RouterLink>
      </nav>
    </aside>
    <div class="main">
      <header class="topbar">
        <span class="user-name">{{ session.fullName }}</span>
        <span v-if="session.role" class="chip">{{ ROLE_LABELS[session.role] }}</span>
        <button class="logout" type="button" @click="logout">Cerrar sesión</button>
      </header>
      <main class="content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.shell { display: flex; min-height: 100vh; }
.sidebar { width: 220px; background: var(--color-primary); color: #fff; padding: var(--space-3); }
.brand { font-weight: 700; font-size: 1.4rem; margin-bottom: var(--space-4); }
.nav-link { display: block; color: #dbe6f5; text-decoration: none; padding: var(--space-2) var(--space-3);
  border-radius: 8px; margin-bottom: var(--space-1); }
.nav-link.router-link-exact-active { background: rgba(255, 255, 255, 0.15); color: #fff; }
.main { flex: 1; display: flex; flex-direction: column; }
.topbar { display: flex; justify-content: flex-end; align-items: center; gap: var(--space-3);
  background: var(--color-surface); border-bottom: 1px solid var(--color-border); padding: var(--space-3) var(--space-4); }
.user-name { font-weight: 600; }
.chip { background: #e6eefb; color: var(--color-primary); padding: 2px 10px; border-radius: 999px; font-size: 0.8rem; }
.logout { border: 1px solid var(--color-border); background: transparent; border-radius: 8px; padding: 6px 12px;
  font: inherit; cursor: pointer; }
.content { padding: var(--space-4); }
</style>