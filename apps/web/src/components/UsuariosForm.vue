<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { crearUsuario, listarUsuarios, type Usuario } from '../services/usuarios.ts';

const usuarios = ref<Usuario[]>([]);
const cargando = ref(false);
const error = ref('');

const form = ref({
  nombre: '',
  apellido: '',
  email: '',
  password: '',
  rol: 'ADMINISTRATIVO',
});

async function cargarUsuarios() {
  usuarios.value = await listarUsuarios();
}

async function onSubmit() {
  error.value = '';
  cargando.value = true;
  try {
    await crearUsuario(form.value);
    form.value = { nombre: '', apellido: '', email: '', password: '', rol: 'ADMINISTRATIVO' };
    await cargarUsuarios();
  } catch (e) {
    error.value = 'No se pudo crear el usuario';
  } finally {
    cargando.value = false;
  }
}

onMounted(cargarUsuarios);
</script>

<template>
  <div>
    <h2>Nuevo usuario</h2>
    <form @submit.prevent="onSubmit">
      <input v-model="form.nombre" placeholder="Nombre" required />
      <input v-model="form.apellido" placeholder="Apellido" required />
      <input v-model="form.email" type="email" placeholder="Email" required />
      <input v-model="form.password" type="password" placeholder="Contraseña" required minlength="6" />
      <select v-model="form.rol">
        <option value="MEDICO">Médico</option>
        <option value="ENFERMERO">Enfermero</option>
        <option value="ADMINISTRATIVO">Administrativo</option>
      </select>
      <button type="submit" :disabled="cargando">
        {{ cargando ? 'Guardando...' : 'Crear' }}
      </button>
    </form>
    <p v-if="error" style="color: red">{{ error }}</p>

    <h2>Usuarios registrados</h2>
    <ul>
      <li v-for="u in usuarios" :key="u.id">
        {{ u.nombre }} {{ u.apellido }} — {{ u.email }} ({{ u.rol }})
      </li>
    </ul>
  </div>
</template>