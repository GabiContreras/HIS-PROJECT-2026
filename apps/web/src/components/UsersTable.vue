<script setup lang="ts">
import type { Usuario } from '../services/usuarios';
import UserStatusChip from './UserStatusChip.vue';

defineProps<{ usuarios: Usuario[] }>();
</script>

<template>
  <table>
    <thead>
      <tr>
        <th>Nombre</th>
        <th>Correo</th>
        <th>Rol</th>
        <th>Estado</th>
        <th><span class="sr-only">Acciones</span></th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="usuario in usuarios" :key="usuario.id">
        <td>{{ usuario.nombre }} {{ usuario.apellido }}</td>
        <td>{{ usuario.email }}</td>
        <td>{{ usuario.rol }}</td>
        <td><UserStatusChip :status="usuario.estado" /></td>
        <td><slot name="actions" :usuario="usuario" /></td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
table { width: 100%; border-collapse: collapse; }
th, td { padding: var(--space-2); border-bottom: 1px solid var(--color-border); text-align: left; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
</style>
