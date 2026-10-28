<script setup lang="ts">
import { computed, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import UserStatusChip from '../../../components/UserStatusChip.vue';
import { useUsers } from '../useUsers';

const route = useRoute();
const userId = computed(() => String(route.params.id));
const { usuario, cargando, error, cargarPorId } = useUsers();

watch(userId, cargarPorId, { immediate: true });
</script>

<template>
  <section>
    <RouterLink :to="{ name: 'users' }">Volver a usuarios</RouterLink>
    <p v-if="cargando" role="status">Cargando usuario...</p>
    <p v-else-if="error" class="error" role="alert">
      {{ error }}
      <button type="button" @click="cargarPorId(userId)">Reintentar</button>
    </p>
    <article v-else-if="usuario" class="card">
      <h1>{{ usuario.nombre }} {{ usuario.apellido }}</h1>
      <dl>
        <div><dt>Correo</dt><dd>{{ usuario.email }}</dd></div>
        <div><dt>Rol</dt><dd>{{ usuario.rol }}</dd></div>
        <div><dt>Estado</dt><dd><UserStatusChip :status="usuario.estado" /></dd></div>
      </dl>
    </article>
  </section>
</template>

<style scoped>
.card { max-width: 600px; margin-top: var(--space-3); padding: var(--space-4); border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); }
dl { display: grid; gap: var(--space-2); }
dt { font-weight: 700; }
dd { margin: 0; }
.error { color: var(--color-danger); }
</style>
