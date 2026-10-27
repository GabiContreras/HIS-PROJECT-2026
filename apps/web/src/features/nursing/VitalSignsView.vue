<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import { usePatients } from '@/composables/usePatients';
import { addVitalSign, listVitalSigns, VITAL_TYPES, type VitalSign } from '@/services/vitalSigns';

const { patients, load: loadPatients } = usePatients();
const records = ref<VitalSign[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const saved = ref<string | null>(null);

const form = reactive({ paciente: '', tipo: VITAL_TYPES[0]!.tipo, valor: '' });

const selectedType = computed(() => VITAL_TYPES.find((t) => t.tipo === form.tipo)!);
const numericValue = computed(() => (form.valor === '' ? null : Number(form.valor)));
const valueError = computed(() => {
  const v = numericValue.value;
  if (v === null) return null;
  const { min, max, unidad } = selectedType.value;
  if (Number.isNaN(v) || v < min || v > max) return `Ingresá un valor entre ${min} y ${max} ${unidad}.`;
  return null;
});
const canSave = computed(() => form.paciente !== '' && numericValue.value !== null && !valueError.value);

async function loadRecords(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    records.value = await listVitalSigns();
  } catch {
    error.value = 'No se pudieron cargar los registros.';
  } finally {
    loading.value = false;
  }
}

async function save(): Promise<void> {
  if (!canSave.value || numericValue.value === null) return;
  try {
    await addVitalSign({
      paciente: form.paciente,
      tipo: form.tipo,
      valor: numericValue.value,
      unidad: selectedType.value.unidad,
    });
    saved.value = `Registro guardado para ${form.paciente}.`;
    form.valor = '';
    await loadRecords();
  } catch {
    error.value = 'No se pudo guardar el registro.';
  }
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });

onMounted(() => Promise.all([loadPatients(), loadRecords()]));
</script>

<template>
  <div class="layout">
    <BaseCard>
      <template #header><h3>Registrar signo vital</h3></template>
      <form @submit.prevent="save">
        <label>
          Paciente
          <select v-model="form.paciente" required>
            <option value="" disabled>Seleccioná un paciente</option>
            <option v-for="p in patients" :key="p.id" :value="`${p.nombre} ${p.apellido}`">
              {{ p.apellido }}, {{ p.nombre }}
            </option>
          </select>
        </label>
        <label>
          Tipo
          <select v-model="form.tipo">
            <option v-for="t in VITAL_TYPES" :key="t.tipo" :value="t.tipo">{{ t.tipo }}</option>
          </select>
        </label>
        <label>
          Valor ({{ selectedType.unidad }})
          <input v-model="form.valor" type="number" step="0.1" required />
        </label>
        <p v-if="valueError" class="error" role="alert">{{ valueError }}</p>
        <button type="submit" :disabled="!canSave">Guardar registro</button>
        <p v-if="saved" class="ok" role="status">{{ saved }}</p>
      </form>
    </BaseCard>

    <BaseCard>
      <template #header><h3>Últimos registros</h3></template>
      <p v-if="error" class="error" role="alert">
        {{ error }} <button type="button" @click="loadRecords">Reintentar</button>
      </p>
      <p v-else-if="loading" role="status">Cargando registros...</p>
      <p v-else-if="records.length === 0">Todavía no hay registros.</p>
      <table v-else>
        <thead><tr><th>Paciente</th><th>Tipo</th><th>Valor</th><th>Fecha</th></tr></thead>
        <tbody>
          <tr v-for="r in records" :key="r.id">
            <td>{{ r.paciente }}</td>
            <td>{{ r.tipo }}</td>
            <td><strong>{{ r.valor }} {{ r.unidad }}</strong></td>
            <td>{{ formatDate(r.fechaHora) }}</td>
          </tr>
        </tbody>
      </table>
    </BaseCard>
  </div>
</template>

<style scoped>
h3 { margin: 0; }
.layout { display: grid; grid-template-columns: 1fr 2fr; gap: var(--space-4); align-items: start; }
.layout > * { min-width: 0; }
form { display: grid; gap: var(--space-3); }
label { display: grid; gap: var(--space-1); font-size: 0.9rem; }
select, input { font: inherit; padding: 8px; border: 1px solid var(--color-border); border-radius: 8px; }
button[type='submit'] { font: inherit; padding: 10px; border: 0; border-radius: 8px; cursor: pointer;
  background: var(--color-primary); color: #fff; font-weight: 600; }
button[type='submit']:disabled { opacity: 0.5; cursor: not-allowed; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: var(--space-2); text-align: left; border-bottom: 1px solid var(--color-border); }
th { color: var(--color-muted); font-size: 0.8rem; }
.error { color: var(--color-danger); margin: 0; }
.ok { color: var(--color-success); margin: 0; }

@media (max-width: 900px) {
  .layout { grid-template-columns: 1fr; }
}
</style>