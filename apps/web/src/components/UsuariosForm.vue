<script setup lang="ts">
import { reactive, watch } from 'vue';
import type { CrearUsuarioInput } from '../services/usuarios';

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
      <input v-model="form.nombre" placeholder="Nombre" required />
      <input v-model="form.apellido" placeholder="Apellido" required />
      <input v-model="form.email" type="email" placeholder="Email" required />
      <input v-model="form.password" type="password" placeholder="Contraseña" required minlength="8" />
      <select v-model="form.rol">
        <option value="MEDICO">Médico</option>
        <option value="ENFERMERO">Enfermero</option>
      </select>
      <p class="hint">La contraseña requiere 8 caracteres, una mayúscula y un número.</p>
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