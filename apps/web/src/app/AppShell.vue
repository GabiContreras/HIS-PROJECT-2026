<script setup lang="ts">
import { ref, computed } from 'vue';
import { RouterLink, RouterView, useRouter } from 'vue-router';
import { useSessionStore } from '../features/iam/session.store';
import { ROLE_LABELS, type Role } from '../features/iam/types';
import RoleChip from '@/components/ui/RoleChip.vue'; // Opcional si prefieres usar tu componente RoleChip

interface MenuItem {
  to: string;
  label: string;
  roles?: Role[];
  enabled?: boolean; // Para manejar módulos deshabilitados si aún no tienen pantalla
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

const menu = computed(() =>
  allItems.filter((item) => !item.roles || (session.role !== null && item.roles.includes(session.role))),
);

// Estado para el buscador de la topbar
const searchQuery = ref('');

const handleSearch = (event: Event) => {
  const target = event.target as HTMLInputElement;
  searchQuery.value = target.value;
};

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
        <template v-for="item in menu" :key="item.to">
          <!-- Si está deshabilitado, lo mostramos opaco o con enlace plano -->
          <RouterLink 
            v-if="item.enabled !== false"
            :to="item.to" 
            class="nav-link"
          >
            {{ item.label }}
          </RouterLink>
          <span v-else class="nav-link disabled">
            {{ item.label }} (Próximamente)
          </span>
        </template>
      </nav>
    </aside>

    <div class="main">
      <header class="topbar">
        <!-- Buscador integrado en la topbar -->
        <div class="search-box">
          <input 
            type="text" 
            v-model="searchQuery" 
            @input="handleSearch" 
            placeholder="Buscar en el sistema..." 
            class="search-input"
          />
        </div>

        <div class="topbar-user-area">
          <span class="user-name">{{ session.fullName }}</span>
          <span v-if="session.role" class="chip">{{ ROLE_LABELS[session.role] }}</span>
          <button class="logout" type="button" @click="logout">Cerrar sesión</button>
        </div>
      </header>

      <main class="content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.shell { display: flex; min-height: 100vh; }
.sidebar { width: 220px; background: var(--color-primary); color: #fff; padding: var(--space-3); display: flex; flex-direction: column; }
.brand { font-weight: 700; font-size: 1.4rem; margin-bottom: var(--space-4); }
.nav-link { display: block; color: #dbe6f5; text-decoration: none; padding: var(--space-2) var(--space-3);
  border-radius: 8px; margin-bottom: var(--space-1); }
.nav-link.router-link-exact-active { background: rgba(255, 255, 255, 0.15); color: #fff; }
.nav-link.disabled { opacity: 0.5; cursor: not-allowed; }

.main { flex: 1; display: flex; flex-direction: column; }
.topbar { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3);
  background: var(--color-surface); border-bottom: 1px solid var(--color-border); padding: var(--space-3) var(--space-4); }

.topbar-user-area { display: flex; align-items: center; gap: var(--space-3); }
.search-input { padding: 6px 12px; border-radius: 8px; border: 1px solid var(--color-border); font: inherit; width: 240px; }
.user-name { font-weight: 600; }
.chip { background: #e6eefb; color: var(--color-primary); padding: 2px 10px; border-radius: 999px; font-size: 0.8rem; }
.logout { border: 1px solid var(--color-border); background: transparent; border-radius: 8px; padding: 6px 12px;
  font: inherit; cursor: pointer; }
.content { padding: var(--space-4); }
</style>