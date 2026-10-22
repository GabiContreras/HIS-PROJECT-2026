
<script setup lang="ts">
import { ref } from 'vue';
import {
  crearPaciente,
  type Paciente,
  type CrearPacienteInput,
} from '../services/pacientes';

const cargando = ref(false);
const error = ref('');
const mensaje = ref('');
const pacienteCreado = ref<Paciente | null>(null);

const formularioInicial = (): CrearPacienteInput => ({
  nombre: '',
  apellido: '',
  documento: '',
  fechaNacimiento: '',
  telefono: '',
});

const form = ref<CrearPacienteInput>(formularioInicial());

async function onSubmit() {
  error.value = '';
  mensaje.value = '';
  pacienteCreado.value = null;
  cargando.value = true;

  try {
    const datos: CrearPacienteInput = {
      ...form.value,
      nombre: form.value.nombre.trim(),
      apellido: form.value.apellido.trim(),
      documento: form.value.documento.trim(),
      telefono: form.value.telefono?.trim() || undefined,
    };

    pacienteCreado.value = await crearPaciente(datos);
    mensaje.value = 'Paciente registrado correctamente.';
    form.value = formularioInicial();
  } catch (e) {
    error.value =
      e instanceof Error
        ? e.message
        : 'No se pudo registrar el paciente.';
  } finally {
    cargando.value = false;
  }
}
</script>

<template>
  <section class="pacientes-form">
    <h2>Registrar paciente</h2>
    <p>Completá los datos para dar de alta a un paciente.</p>

    <form @submit.prevent="onSubmit">
      <label for="nombre">Nombre</label>
      <input
        id="nombre"
        v-model="form.nombre"
        maxlength="100"
        required
        autocomplete="given-name"
      />

      <label for="apellido">Apellido</label>
      <input
        id="apellido"
        v-model="form.apellido"
        maxlength="100"
        required
        autocomplete="family-name"
      />

      <label for="documento">Documento</label>
      <input
        id="documento"
        v-model="form.documento"
        maxlength="20"
        required
      />

      <label for="fechaNacimiento">Fecha de nacimiento</label>
      <input
        id="fechaNacimiento"
        v-model="form.fechaNacimiento"
        type="date"
        :max="new Date().toLocaleDateString('en-CA')"
        required
      />

      <label for="telefono">Teléfono (opcional)</label>
      <input
        id="telefono"
        v-model="form.telefono"
        type="tel"
        maxlength="30"
        autocomplete="tel"
      />

      <button type="submit" :disabled="cargando">
        {{ cargando ? 'Guardando...' : 'Registrar paciente' }}
      </button>
    </form>

    <p v-if="error" class="mensaje error" role="alert">
      {{ error }}
    </p>

    <p v-if="mensaje" class="mensaje exito" role="status">
      {{ mensaje }}
    </p>

    <div v-if="pacienteCreado" class="resultado">
      <h3>Paciente registrado</h3>
      <p>
        {{ pacienteCreado.nombre }} {{ pacienteCreado.apellido }}
      </p>
      <p>Documento: {{ pacienteCreado.documento }}</p>
      <p>ID: {{ pacienteCreado.id }}</p>
    </div>
  </section>
</template>

<style scoped>
.pacientes-form {
  max-width: 520px;
  margin: 0 auto;
}

form {
  display: grid;
  gap: 10px;
}

input,
button {
  padding: 10px;
  font: inherit;
}

button {
  margin-top: 10px;
  cursor: pointer;
}

button:disabled {
  cursor: wait;
  opacity: 0.7;
}

.mensaje.error {
  color: #b42318;
}

.mensaje.exito {
  color: #187443;
}

.resultado {
  margin-top: 16px;
  padding: 12px;
  border: 1px solid #187443;
  border-radius: 8px;
  overflow-wrap: anywhere;
}
</style>
