<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import DataTable from '@/components/ui/DataTable.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { usePatients } from '@/composables/usePatients';
import { useVitalSigns } from '@/composables/useVitalSigns';
import { ApiError } from '@/shared/http';
import { vitalTypeLabel, type TipoSignoVital } from '@/services/vitalSigns';

const { patients, error: patientsError, load: loadPatients } = usePatients();
const { types, records, loading, error, load, register } = useVitalSigns();

const form = reactive<{ pacienteId: string; tipo: TipoSignoVital | ''; valor: string }>({
  pacienteId: '',
  tipo: '',
  valor: '',
});
const saving = ref(false);
const saved = ref<string | null>(null);
const submitError = ref<string | null>(null);

const columns = [
  { key: 'paciente', label: 'Paciente' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'valor', label: 'Valor' },
  { key: 'fechaHora', label: 'Fecha' },
];

const selectedType = computed(() => types.value.find((t) => t.tipo === form.tipo) ?? null);
const numericValue = computed(() => (form.valor.trim() === '' ? null : Number(form.valor)));

const valueError = computed(() => {
  const v = numericValue.value;
  const t = selectedType.value;
  if (v === null || !t) return null;
  if (!Number.isFinite(v)) return 'Ingresá un valor numérico.';
  if (v < t.minPlausible || v > t.maxPlausible) {
    return `Valor implausible: debe estar entre ${t.minPlausible} y ${t.maxPlausible} ${t.unidad}.`;
  }
  if (!/^-?\d+(\.\d{1,2})?$/.test(form.valor.trim())) return 'Usá como máximo 2 decimales.';
  return null;
});
const canSave = computed(
  () => form.pacienteId !== '' && selectedType.value !== null && numericValue.value !== null && !valueError.value && !saving.value,
);

async function save(): Promise<void> {
  if (!canSave.value || numericValue.value === null || form.tipo === '') return;
  saving.value = true;
  saved.value = null;
  submitError.value = null;
  try {
    const created = await register({ pacienteId: form.pacienteId, tipo: form.tipo, valor: numericValue.value });
    saved.value = created.fueraDeRango
      ? `Registro guardado para ${created.paciente}. El valor está fuera de rango: se alertó al médico.`
      : `Registro guardado para ${created.paciente}.`;
    form.valor = '';
  } catch (e) {
    submitError.value = e instanceof ApiError ? e.message : 'No se pudo guardar el registro.';
  } finally {
    saving.value = false;
  }
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });

onMounted(async () => {
  await Promise.all([loadPatients(), load()]);
  if (form.tipo === '' && types.value.length > 0) form.tipo = types.value[0]!.tipo;
});
</script>

<template>
  <div class="layout">
    <BaseCard>
      <template #header><h3>Registrar signo vital</h3></template>
      <p v-if="patientsError" class="error" role="alert">
        {{ patientsError }} <button type="button" @click="loadPatients">Reintentar</button>
      </p>
      <form novalidate @submit.prevent="save">
        <label>
          Paciente
          <select v-model="form.pacienteId" required>
            <option value="" disabled>Seleccioná un paciente</option>
            <option v-for="p in patients" :key="p.id" :value="p.id">
              {{ p.apellido }}, {{ p.nombre }} ({{ p.documento }})
            </option>
          </select>
        </label>
        <label>
          Tipo
          <select v-model="form.tipo" required :disabled="types.length === 0">
            <option v-for="t in types" :key="t.tipo" :value="t.tipo">{{ vitalTypeLabel(t.tipo) }}</option>
          </select>
        </label>
        <label>
          Valor{{ selectedType ? ` (${selectedType.unidad})` : '' }}
          <input v-model="form.valor" type="number" step="any" inputmode="decimal" required />
          <small v-if="selectedType" class="hint">
            Rango normal: {{ selectedType.minNormal }} a {{ selectedType.maxNormal }} {{ selectedType.unidad }}.
          </small>
        </label>
        <p v-if="valueError" class="error" role="alert">{{ valueError }}</p>
        <p v-if="submitError" class="error" role="alert">{{ submitError }}</p>
        <button type="submit" :disabled="!canSave">{{ saving ? 'Guardando...' : 'Guardar registro' }}</button>
        <p v-if="saved" class="ok" role="status">{{ saved }}</p>
      </form>
    </BaseCard>

    <BaseCard>
      <template #header><h3>Últimos registros</h3></template>
      <p v-if="error" class="error" role="alert">
        {{ error }} <button type="button" :disabled="loading" @click="load">Reintentar</button>
      </p>
      <p v-else-if="loading && records.length === 0" role="status">Cargando registros...</p>
      <p v-else-if="records.length === 0">Todavía no hay registros.</p>
      <DataTable v-else :data="records" :columns="columns">
        <template #cell-tipo="{ row }">{{ vitalTypeLabel(row.tipo) }}</template>
        <template #cell-valor="{ row }">
          <strong :class="{ 'out-of-range': row.fueraDeRango }">{{ row.valor }} {{ row.unidad }}</strong>
          <StatusChip v-if="row.fueraDeRango" label="Fuera de rango" tone="danger" />
        </template>
        <template #cell-fechaHora="{ row }">{{ formatDate(row.fechaHora) }}</template>
      </DataTable>
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
.hint { color: var(--color-muted); }
button[type='submit'] { font: inherit; padding: 10px; border: 0; border-radius: 8px; cursor: pointer;
  background: var(--color-primary); color: #fff; font-weight: 600; }
button[type='submit']:disabled { opacity: 0.5; cursor: not-allowed; }
.out-of-range { color: var(--color-danger); margin-right: var(--space-2); }
:deep(.data-table) { width: 100%; border-collapse: collapse; }
:deep(.data-table th), :deep(.data-table td) { padding: var(--space-2); text-align: left; border-bottom: 1px solid var(--color-border); }
:deep(.data-table th) { color: var(--color-muted); font-size: 0.8rem; }
.error { color: var(--color-danger); margin: 0; }
.ok { color: var(--color-success); margin: 0; }

@media (max-width: 900px) {
  .layout { grid-template-columns: 1fr; }
}
</style>
