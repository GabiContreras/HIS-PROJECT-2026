<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { createPatient, searchPatients, type Patient } from '@/services/patients';
import { ApiError } from '@/shared/http';
import { useSessionStore } from '@/features/iam/session.store';

const route = useRoute();
const session = useSessionStore();
const patients = ref<Patient[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const query = ref(String(route.query.q ?? ''));

const showForm = ref(false);
const saving = ref(false);
const formError = ref<string | null>(null);
const created = ref<string | null>(null);
const form = reactive({ nombre: '', apellido: '', documento: '', fechaNacimiento: '', telefono: '' });

let timer: ReturnType<typeof setTimeout> | undefined;
let latest = 0;

function messageFrom(reason: unknown, fallback: string): string {
  return reason instanceof ApiError ? reason.message : fallback;
}

async function load(): Promise<void> {
  const current = ++latest;
  loading.value = true;
  error.value = null;
  try {
    const result = await searchPatients(query.value);
    if (current === latest) patients.value = result;
  } catch (reason) {
    if (current === latest) error.value = messageFrom(reason, 'No se pudo cargar la lista de pacientes.');
  } finally {
    if (current === latest) loading.value = false;
  }
}

watch(() => route.query.q, (q) => { query.value = String(q ?? ''); });
watch(query, () => {
  clearTimeout(timer);
  timer = setTimeout(load, 300);
});

async function save(): Promise<void> {
  saving.value = true;
  formError.value = null;
  created.value = null;
  try {
    const telefono = form.telefono.trim();
    const paciente = await createPatient({
      nombre: form.nombre,
      apellido: form.apellido,
      documento: form.documento,
      fechaNacimiento: form.fechaNacimiento,
      ...(telefono ? { telefono } : {}),
    });
    created.value = `${paciente.apellido}, ${paciente.nombre}`;
    Object.assign(form, { nombre: '', apellido: '', documento: '', fechaNacimiento: '', telefono: '' });
    showForm.value = false;
    await load();
  } catch (reason) {
    formError.value = messageFrom(reason, 'No se pudo registrar el paciente.');
  } finally {
    saving.value = false;
  }
}

function age(birth: string): number {
  const b = new Date(birth);
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) years -= 1;
  return years;
}

onMounted(load);
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <section>
    <header class="head">
      <div>
        <h1>Pacientes</h1>
        <p>Buscá por nombre, apellido o documento.</p>
      </div>
      <div class="tools">
        <input v-model="query" type="search" placeholder="Buscar paciente..." />
        <button v-if="session.role === 'ADMINISTRATIVO'" type="button" @click="showForm = !showForm">
          {{ showForm ? 'Cerrar' : 'Nuevo paciente' }}
        </button>
      </div>
    </header>

    <p v-if="created" role="status">Paciente registrado: {{ created }}.</p>
    <form v-if="showForm" class="new-patient" @submit.prevent="save">
      <label>Nombre <input v-model="form.nombre" required maxlength="80" /></label>
      <label>Apellido <input v-model="form.apellido" required maxlength="80" /></label>
      <label>Documento <input v-model="form.documento" required inputmode="numeric" pattern="\d{7,9}" title="Entre 7 y 9 dígitos" /></label>
      <label>Fecha de nacimiento <input v-model="form.fechaNacimiento" type="date" required /></label>
      <label>Teléfono (opcional) <input v-model="form.telefono" type="tel" /></label>
      <button type="submit" :disabled="saving">{{ saving ? 'Guardando...' : 'Registrar paciente' }}</button>
      <p v-if="formError" class="error" role="alert">{{ formError }}</p>
    </form>

    <p v-if="error" class="error" role="alert">
      {{ error }} <button type="button" :disabled="loading" @click="load">Reintentar</button>
    </p>
    <p v-else-if="loading" role="status">Cargando pacientes...</p>
    <p v-else-if="patients.length === 0">No se encontraron pacientes.</p>
    <table v-else>
      <thead>
        <tr><th>Paciente</th><th>Documento</th><th>Edad</th><th>Teléfono</th></tr>
      </thead>
      <tbody>
        <tr v-for="p in patients" :key="p.id">
          <td>{{ p.apellido }}, {{ p.nombre }}</td>
          <td>{{ p.documento }}</td>
          <td>{{ age(p.fechaNacimiento) }} años</td>
          <td>{{ p.telefono ?? '—' }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: end; flex-wrap: wrap; gap: var(--space-3); margin-bottom: var(--space-3); }
.head h1, .head p { margin: 0; }
.head p { color: var(--color-muted); margin-top: var(--space-1); }
.tools { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.new-patient { display: flex; flex-wrap: wrap; align-items: end; gap: var(--space-3); margin-bottom: var(--space-3); }
.new-patient label { display: grid; gap: var(--space-1); }
.new-patient input { font: inherit; padding: 8px 12px; border: 1px solid var(--color-border); border-radius: 8px; }
.head input { font: inherit; padding: 8px 12px; border: 1px solid var(--color-border); border-radius: 8px; min-width: 240px; }
table { width: 100%; border-collapse: collapse; background: var(--color-surface); border-radius: var(--radius); }
th, td { padding: var(--space-2) var(--space-3); text-align: left; border-bottom: 1px solid var(--color-border); }
th { color: var(--color-muted); font-size: 0.8rem; }
tbody tr:hover { background: #f1f5f9; }
.error { color: var(--color-danger); }
</style>