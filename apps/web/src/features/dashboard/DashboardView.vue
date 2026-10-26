<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useSessionStore } from '../iam/session.store.ts';

const session = useSessionStore();

const actions = computed(() => {
  if (session.role === 'ADMINISTRATIVO') {
    return [
      { title: 'Usuarios', description: 'Administrá las cuentas del personal.', to: { name: 'users' } },
      { title: 'Turnos', description: 'Consultá la agenda y creá franjas para médicos.', to: { name: 'appointments' } },
    ];
  }
  if (session.role === 'MEDICO') {
    return [
      { title: 'Mi agenda', description: 'Creá tus franjas y gestioná los turnos asignados.', to: { name: 'appointments' } },
    ];
  }
  return [
    { title: 'Turnos disponibles', description: 'La consulta de turnos disponibles estará disponible en el próximo flujo.', to: null },
  ];
});
</script>

<template>
  <section>
    <h1>Panel</h1>
    <p>Hola, {{ session.fullName }}.</p>
    <div class="cards">
      <article v-for="action in actions" :key="action.title" class="card">
        <h2>{{ action.title }}</h2>
        <p>{{ action.description }}</p>
        <RouterLink v-if="action.to" :to="action.to">Ir al módulo</RouterLink>
      </article>
    </div>
  </section>
</template>

<style scoped>
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--space-3); margin-top: var(--space-4); }
.card { padding: var(--space-4); border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); }
.card h2, .card p { margin-top: 0; }
</style>