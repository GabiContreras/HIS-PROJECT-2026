<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import AppIcon from './ui/AppIcon.vue';
import { searchPatients, type Patient } from '../services/patients';
import { messageFrom } from '../shared/errors';
import { formatDocument } from '../shared/format';

const props = defineProps<{ modelValue: Patient | null }>();
const emit = defineEmits<{ 'update:modelValue': [patient: Patient | null] }>();

const query = ref('');
const results = ref<Patient[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

let timer: ReturnType<typeof setTimeout> | undefined;
let request = 0;

const hasQuery = computed(() => query.value.trim().length > 0);

async function run(): Promise<void> {
  const current = ++request;
  if (!hasQuery.value) {
    results.value = [];
    loading.value = false;
    error.value = null;
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    const found = await searchPatients(query.value);
    if (current === request) results.value = found;
  } catch (reason) {
    if (current === request) error.value = messageFrom(reason, 'No se pudo buscar pacientes.');
  } finally {
    if (current === request) loading.value = false;
  }
}

watch(query, () => {
  clearTimeout(timer);
  timer = setTimeout(run, 300);
});
onBeforeUnmount(() => clearTimeout(timer));

function pick(patient: Patient): void {
  emit('update:modelValue', patient);
  query.value = '';
  results.value = [];
}

const fullName = (p: Patient) => `${p.nombre} ${p.apellido}`;
const initials = (p: Patient) => `${p.nombre.charAt(0)}${p.apellido.charAt(0)}`.toUpperCase();
const dni = (p: Patient) => formatDocument(p.documento);
</script>

<template>
  <div class="search">
    <div class="field">
      <AppIcon name="search" :size="18" class="lead" />
      <input
        v-model="query"
        type="search"
        placeholder="Buscar por nombre o DNI"
        aria-label="Buscar paciente por nombre o DNI"
        autocomplete="off"
      />
    </div>

    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <p v-else-if="loading" class="hint" role="status">Buscando...</p>
    <p v-else-if="hasQuery && results.length === 0" class="hint">
      No se encontró ningún paciente registrado con ese dato.
    </p>
    <ul v-else-if="results.length > 0" class="results" aria-label="Resultados de la búsqueda">
      <li v-for="p in results" :key="p.id">
        <button type="button" @click="pick(p)">
          <span class="avatar">{{ initials(p) }}</span>
          <span class="who">
            <strong>{{ fullName(p) }}</strong>
            <small>DNI {{ dni(p) }}</small>
          </span>
        </button>
      </li>
    </ul>

    <div v-if="props.modelValue" class="selected" role="status">
      <span class="avatar">{{ initials(props.modelValue) }}</span>
      <span class="who">
        <strong>{{ fullName(props.modelValue) }}</strong>
        <small>DNI {{ dni(props.modelValue) }} · Paciente registrado</small>
      </span>
      <AppIcon name="check" :size="18" class="ok" />
      <button type="button" class="remove" aria-label="Quitar paciente seleccionado" @click="emit('update:modelValue', null)">
        <AppIcon name="x" :size="14" />
      </button>
    </div>

    <p class="rule"><AppIcon name="check" :size="14" /> Solo se puede reservar para pacientes registrados.</p>
  </div>
</template>

<style scoped>
.search { display: grid; gap: 10px; }
.field { position: relative; }
.field .lead { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--color-muted); pointer-events: none; }
.field input { padding: 12px 14px 12px 42px; border-radius: 10px; }
.results { list-style: none; margin: 0; padding: 4px; max-height: 232px; overflow-y: auto; border: 1px solid var(--color-line); border-radius: 10px; }
.results button { width: 100%; display: flex; align-items: center; gap: 12px; padding: 9px 10px; border: 0; border-radius: 8px;
  background: #fff; text-align: left; font-weight: 500; }
.results button:hover { background: var(--color-brand-soft); }
.avatar { display: grid; place-items: center; width: 36px; height: 36px; flex-shrink: 0; border-radius: 50%;
  background: #cfe7e1; color: var(--color-brand-dark); font-size: 0.78rem; font-weight: 700; }
.who { display: grid; min-width: 0; flex: 1; }
.who strong { font-size: 0.9rem; }
.who small { color: var(--color-muted); font-size: 0.78rem; }
.selected { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid #b7d9d1; border-radius: 10px; background: var(--color-brand-soft); }
.ok { color: var(--color-brand); flex-shrink: 0; }
.remove { display: grid; place-items: center; width: 26px; height: 26px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--color-muted); }
.remove:hover:not(:disabled) { background: #fff; }
.rule { display: flex; align-items: center; gap: 6px; color: var(--color-brand); font-size: 0.78rem; font-weight: 500; }
</style>
