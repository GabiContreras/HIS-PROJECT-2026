<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <section>
    <h1>Enfermería</h1>
    <nav class="tabs" aria-label="Secciones de enfermería">
      <RouterLink :to="{ name: 'vital-signs' }" class="tab">Signos vitales</RouterLink>
      <RouterLink :to="{ name: 'medications' }" class="tab">Medicaciones</RouterLink>
    </nav>
    <RouterView />
  </section>
</template>

<style scoped>
h1 { margin-top: 0; }
.tabs { display: flex; gap: var(--space-2); margin-bottom: var(--space-4); border-bottom: 1px solid var(--color-border); }
.tab { padding: var(--space-2) var(--space-3); text-decoration: none; color: var(--color-muted);
  border-bottom: 3px solid transparent; margin-bottom: -1px; }
.tab:hover { color: var(--color-text); }
.tab.router-link-active { color: var(--color-primary); border-bottom-color: var(--color-primary); font-weight: 600; }
</style>