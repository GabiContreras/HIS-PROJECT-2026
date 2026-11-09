<script setup lang="ts">
import { reactive, watch } from 'vue';
import type { CrearUsuarioInput } from '../services/users';

const props = defineProps<{
  submitting: boolean;
  visible: boolean;
}>();

const emit = defineEmits<{
  submit: [datos: CrearUsuarioInput];
  cancel: [];
}>();

const form = reactive<CrearUsuarioInput>({
  nombre: '',
  apellido: '',
  email: '',
  password: '',
  rol: 'MEDICO',
});

function reset(): void {
  Object.assign(form, {
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    rol: 'MEDICO',
  });
}

function onSubmit(): void {
  emit('submit', { ...form });
}

function cancel(): void {
  reset();
  emit('cancel');
}

watch(
  () => props.visible,
  (visible, wasVisible) => {
    if (visible && !wasVisible) reset();
  }
);
</script>

<template>
  <section v-show="visible" class="modal" aria-labelledby="create-user-title">
    <h2 id="create-user-title">Nuevo usuario</h2>
    <form @submit.prevent="onSubmit">
      <label for="user-name">Nombre</label>
      <input id="user-name" v-model="form.nombre" placeholder="Nombre" required />
      <label for="user-lastname">Apellido</label>
      <input id="user-lastname" v-model="form.apellido" placeholder="Apellido" required />
      <label for="user-email">Correo electrónico</label>
      <input id="user-email" v-model="form.email" type="email" placeholder="Email" required />
      <label for="user-password">Contraseña</label>
      <input id="user-password" v-model="form.password" type="password" placeholder="Contraseña" required minlength="8" />
      <label for="user-role">Rol</label>
      <select id="user-role" v-model="form.rol">
        <option value="MEDICO">Médico</option>
        <option value="ENFERMERO">Enfermero</option>
      </select>
      <p class="hint">La contraseña requiere al menos 8 caracteres, una mayúscula y un número, y no debe contener números consecutivos.</p>
      <div class="actions">
        <button type="button" :disabled="submitting" @click="cancel">Cancelar</button>
        <button type="submit" :disabled="submitting">
          {{ submitting ? 'Guardando...' : 'Crear' }}
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.modal { max-width: 560px; padding: var(--space-4); border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); }
form { display: grid; gap: var(--space-2); }
input, select, button { font: inherit; padding: 8px; }
.actions { display: flex; justify-content: flex-end; gap: var(--space-2); }
.hint { margin: 0; font-size: 0.875rem; }
</style>