<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <div class="page">
    <nav class="tabs" aria-label="Secciones de enfermería">
      <RouterLink :to="{ name: 'vital-signs' }" class="tab">Signos vitales</RouterLink>
      <RouterLink :to="{ name: 'medications' }" class="tab">Medicaciones</RouterLink>
      <RouterLink :to="{ name: 'protocols' }" class="tab">Protocolos de ingreso</RouterLink>
    </nav>
    <RouterView />
  </div>
</template>

<style scoped>
.tabs { display: flex; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid var(--color-line); }
.tab { padding: 10px 14px; color: var(--color-muted); font-weight: 600; border-bottom: 3px solid transparent; margin-bottom: -1px; }
.tab:hover { color: var(--color-ink); text-decoration: none; }
.tab.router-link-active { color: var(--color-brand); border-bottom-color: var(--color-brand); }
</style>
