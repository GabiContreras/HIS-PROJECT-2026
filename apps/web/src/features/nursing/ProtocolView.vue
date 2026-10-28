<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import DataTable from '@/components/ui/DataTable.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { usePatients } from '@/composables/usePatients';
import { useProtocols } from '@/composables/useProtocols';
import { ingresoTypeLabel } from '@/services/protocols';

const { patients, error: patientsError, load: loadPatients } = usePatients();
const { protocols, loading, error, load, clear } = useProtocols();

const selectedPatient = ref('');

const columns = [
  { key: 'orden', label: '#' },
  { key: 'descripcion', label: 'Tarea' },
  { key: 'frecuenciaHoras', label: 'Frecuencia' },
];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });

const frequency = (horas: number | null) => (horas === null ? '—' : `Cada ${horas} h`);

function reload(): void {
  if (selectedPatient.value !== '') void load(selectedPatient.value);
}

watch(selectedPatient, (id) => {
  if (id === '') clear();
  else void load(id);
});

onMounted(loadPatients);
</script>

<template>
  <div class="stack">
    <BaseCard>
      <template #header><h3>Protocolo de ingreso</h3></template>
      <p v-if="patientsError" class="error" role="alert">
        {{ patientsError }} <button type="button" @click="loadPatients">Reintentar</button>
      </p>
      <label>
        Paciente
        <select v-model="selectedPatient">
          <option value="">Seleccioná un paciente</option>
          <option v-for="p in patients" :key="p.id" :value="p.id">
            {{ p.apellido }}, {{ p.nombre }} ({{ p.documento }})
          </option>
        </select>
      </label>
    </BaseCard>

    <p v-if="selectedPatient === ''" class="muted">Elegí un paciente para ver su protocolo de atención.</p>
    <p v-else-if="error" class="error" role="alert">
      {{ error }} <button type="button" :disabled="loading" @click="reload">Reintentar</button>
    </p>
    <p v-else-if="loading" role="status">Cargando protocolo...</p>
    <p v-else-if="protocols.length === 0">Este paciente no tiene protocolo.</p>

    <template v-else>
    <BaseCard v-for="protocolo in protocols" :key="protocolo.id">
      <template #header>
        <h3>{{ ingresoTypeLabel(protocolo.tipo) }}</h3>
        <StatusChip :label="protocolo.motivoIngreso" tone="info" />
      </template>
      <p class="muted">Generado el {{ formatDate(protocolo.generadoEn) }}</p>
      <DataTable :data="protocolo.tareas" :columns="columns">
        <template #cell-frecuenciaHoras="{ row }">{{ frequency(row.frecuenciaHoras) }}</template>
      </DataTable>
    </BaseCard>
    </template>
  </div>
</template>

<style scoped>
h3 { margin: 0; }
.stack { display: grid; gap: var(--space-4); max-width: 900px; }
label { display: grid; gap: var(--space-1); font-size: 0.9rem; }
select { font: inherit; padding: 8px; border: 1px solid var(--color-border); border-radius: 8px; }
.muted { color: var(--color-muted); margin: 0 0 var(--space-2); }
.error { color: var(--color-danger); margin: 0; }
:deep(.data-table) { width: 100%; border-collapse: collapse; }
:deep(.data-table th), :deep(.data-table td) { padding: var(--space-2); text-align: left; border-bottom: 1px solid var(--color-border); }
:deep(.data-table th) { color: var(--color-muted); font-size: 0.8rem; }
</style>
