<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import UsuariosForm from '../../../components/UsuariosForm.vue';
import UsersTable from '../../../components/UsersTable.vue';
import { type CrearUsuarioInput } from '../../../services/users';
import { useUsers } from '../useUsers';

const formVisible = ref(false);
const { usuarios, cargando, error, cargar, crear } = useUsers();

async function crearUsuario(datos: CrearUsuarioInput): Promise<void> {
  if (await crear(datos)) formVisible.value = false;
}

onMounted(cargar);
</script>

<template>
  <section class="users-view">
    <header class="page-header">
      <div>
        <h1>Usuarios</h1>
        <p>Administrá las cuentas del personal hospitalario.</p>
      </div>
      <button class="btn" type="button" @click="formVisible = true">Nuevo usuario</button>
    </header>

    <UsuariosForm
      :visible="formVisible"
      :submitting="cargando"
      @submit="crearUsuario"
      @cancel="formVisible = false"
    />

    <p v-if="error" class="error" role="alert">
      {{ error }}
      <button type="button" :disabled="cargando" @click="cargar">Reintentar</button>
    </p>
    <p v-else-if="cargando" role="status">Cargando usuarios...</p>
    <p v-else-if="usuarios.length === 0">Todavía no hay usuarios registrados.</p>
    <UsersTable v-else :usuarios="usuarios">
      <template #actions="{ usuario }">
        <RouterLink class="btn btn-sm btn-secondary" :to="{ name: 'user-detail', params: { id: usuario.id } }">Ver detalle</RouterLink>
      </template>
    </UsersTable>
  </section>
</template>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); margin-bottom: var(--space-4); }
.page-header h1, .page-header p { margin: 0; }
.page-header p { margin-top: var(--space-1); }
button { font: inherit; padding: 8px 12px; }
.error { color: var(--color-danger); }
.error button { margin-left: var(--space-2); }
@media (max-width: 640px) {
  .page-header { flex-direction: column; }
}
</style>