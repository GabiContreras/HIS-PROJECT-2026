<script setup lang="ts">
import { ref } from 'vue';
import RoleChip from '@/components/ui/RoleChip.vue'; // Ajusta la ruta si es necesario

// Estado para la barra lateral responsive (colapsable en pantallas chicas)
const isSidebarOpen = ref(true);

// Simulación de datos de sesión del usuario (reemplaza esto con tu store de Pinia o lógica real)
const session = ref({
  fullName: 'Dra. María Pérez',
  role: 'Médico' as 'Médico' | 'Enfermero' | 'Administrativo'
});

// Lista de módulos del sidebar basados en Figma
const modules = [
  { name: 'Dashboard', path: '/dashboard', enabled: true, roles: ['Médico', 'Enfermero', 'Administrativo'] },
  { name: 'Turnos', path: '/appointments', enabled: true, roles: ['Médico', 'Administrativo'] },
  { name: 'Pacientes', path: '/patients', enabled: true, roles: ['Médico', 'Enfermero'] },
  { name: 'Reportes', path: '/reports', enabled: false, roles: ['Administrativo'] } // Módulo sin pantalla (deshabilitado)
];

// Estado del buscador de la topbar
const searchQuery = ref('');

const handleSearch = (event: Event) => {
  const target = event.target as HTMLInputElement;
  searchQuery.value = target.value;
  // Aquí puedes agregar lógica de debounce o emitir el evento
};

const logout = () => {
  // Lógica para cerrar sesión
  console.log('Cerrando sesión...');
};
</script>

<template>
  <div class="app-shell">
    <!-- Botón para alternar sidebar en pantallas chicas (responsive con v-show / v-if) -->
    <button class="menu-toggle" @click="isSidebarOpen = !isSidebarOpen">
      ☰
    </button>

    <!-- Sidebar -->
    <aside class="sidebar" v-show="isSidebarOpen">
      <div class="sidebar-brand">
        <h2>HIS Project</h2>
      </div>

      <nav class="sidebar-nav">
        <ul>
          <li v-for="mod in modules" :key="mod.name">
            <!-- Módulos deshabilitados con :class o v-if -->
            <router-link 
              :to="mod.enabled ? mod.path : '#'" 
              :class="{ 'disabled': !mod.enabled }"
            >
              {{ mod.name }}
            </router-link>
          </li>
        </ul>
      </nav>

      <!-- Cerrar sesión al pie de la sidebar -->
      <div class="sidebar-footer">
        <button @click="logout" class="logout-btn">Cerrar Sesión</button>
      </div>
    </aside>

    <!-- Contenido Principal -->
    <div class="main-container">
      <!-- Topbar -->
      <header class="topbar">
        <!-- Buscador con v-model y @input -->
        <div class="search-box">
          <input 
            type="text" 
            v-model="searchQuery" 
            @input="handleSearch" 
            placeholder="Buscar..." 
          />
        </div>

        <div class="topbar-right">
          <!-- Campana de notificaciones -->
          <button class="notification-bell" aria-label="Notificaciones">
            🔔
          </button>

          <!-- session.fullName más RoleChip -->
          <div class="user-info">
            <span class="user-name">{{ session.fullName }}</span>
            <RoleChip :role="session.role" />
          </div>
        </div>
      </header>

      <!-- Vista dinámica de las rutas -->
      <main class="content-view">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
/* Estilos básicos de estructura (puedes adaptarlos a tus clases de CSS o Tailwind) */
.app-shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  width: 260px;
  background-color: #1e293b;
  color: white;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.sidebar-nav ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.sidebar-nav li a {
  display: block;
  padding: 12px 20px;
  color: #94a3b8;
  text-decoration: none;
}

.sidebar-nav li a.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.main-container {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.topbar {
  height: 60px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 15px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.content-view {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background-color: #f8fafc;
}

.menu-toggle {
  display: none;
}

/* Responsivo básico */
@media (max-width: 768px) {
  .sidebar {
    position: absolute;
    height: 100%;
    z-index: 10;
  }
  .menu-toggle {
    display: block;
    position: absolute;
    top: 15px;
    left: 20px;
    z-index: 11;
  }
}
</style>