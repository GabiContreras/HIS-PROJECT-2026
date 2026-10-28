<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { searchPatients, type Patient } from '../services/patients';
import { messageFrom } from '../shared/errors';

const props = defineProps<{ modelValue: Patient | null; label?: string }>();
const emit = defineEmits<{ 'update:modelValue': [patient: Patient | null] }>();

const query = ref('');
const results = ref<Patient[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

let timer: ReturnType<typeof setTimeout> | undefined;
let request = 0;

async function run(): Promise<void> {
  const current = ++request;
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
onMounted(run);
onBeforeUnmount(() => clearTimeout(timer));

const fullName = (p: Patient) => `${p.apellido}, ${p.nombre}`;
</script>

<template>
  <div class="picker">
    <label>
      {{ label ?? 'Paciente' }}
      <input v-model="query" type="search" placeholder="Buscar por nombre, apellido o documento" />
    </label>
    <p v-if="props.modelValue" class="selected">
      Seleccionado: <strong>{{ fullName(props.modelValue) }}</strong> · DNI {{ props.modelValue.documento }}
      <button type="button" class="btn-sm" @click="emit('update:modelValue', null)">Quitar</button>
    </p>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <p v-else-if="loading" class="hint" role="status">Buscando...</p>
    <p v-else-if="results.length === 0" class="hint">No se encontraron pacientes. Pedí a un administrativo que lo registre.</p>
    <ul v-else class="results">
      <li v-for="p in results" :key="p.id">
        <button type="button" :class="{ active: props.modelValue?.id === p.id }" @click="emit('update:modelValue', p)">
          <span>{{ fullName(p) }}</span>
          <small>DNI {{ p.documento }}</small>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.picker { display: grid; gap: 8px; }
.selected { font-size: 0.85rem; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.results { list-style: none; margin: 0; padding: 0; max-height: 180px; overflow-y: auto; border: 1px solid var(--color-line); border-radius: 8px; }
.results li + li { border-top: 1px solid var(--color-line); }
.results button { width: 100%; display: flex; justify-content: space-between; gap: 12px; border: 0; border-radius: 0; background: #fff; text-align: left; font-weight: 500; }
.results button:hover, .results button.active { background: var(--color-brand-soft); }
small { color: var(--color-muted); }
</style>
