<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';

const menu = [
  { to: '/', label: 'Panel' },
  { to: '/usuarios', label: 'Usuarios' },
];
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
        <span class="muted">Sin sesión</span>
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
.topbar { background: var(--color-surface); border-bottom: 1px solid var(--color-border);
  padding: var(--space-3) var(--space-4); }
.content { padding: var(--space-4); }
.muted { color: var(--color-muted); }
</style>