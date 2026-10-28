<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import DataTable from '@/components/ui/DataTable.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { useInventory } from '@/composables/useInventory';
import { useMedications } from '@/composables/useMedications';
import { usePatients } from '@/composables/usePatients';
import { useSessionStore } from '@/features/iam/session.store';
import { ApiError } from '@/shared/http';

const session = useSessionStore();
const { indications, pendingCount, totalDoses, loading, error, load, administer } = useMedications();
const { patients, error: patientsError, load: loadPatients } = usePatients();
const inventory = useInventory();

const selectedPatient = ref('');
const administeringId = ref<string | null>(null);
const actionError = ref<string | null>(null);
const actionOk = ref<string | null>(null);

const canAdminister = computed(() => session.role === 'ENFERMERO');

const columns = [
  { key: 'hora', label: 'Horario' },
  { key: 'paciente', label: 'Paciente' },
  { key: 'insumo', label: 'Medicamento' },
  { key: 'dosis', label: 'Dosis' },
  { key: 'frecuencia', label: 'Frecuencia' },
  { key: 'stock', label: 'Stock' },
  { key: 'estado', label: 'Estado' },
  { key: 'accion', label: '' },
];

interface DoseRow {
  key: string;
  indicacionId: string;
  hora: string;
  paciente: string;
  insumo: string;
  dosis: string;
  frecuencia: string;
  stock: string;
  estado: 'PENDIENTE' | 'ADMINISTRADA' | null;
  enVentana: boolean;
  detalle: string;
}

const time = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

const rows = computed<DoseRow[]>(() =>
  indications.value.flatMap((ind): DoseRow[] => {
    const item = inventory.items.value.find((i) => i.id === ind.insumoId);
    const base = {
      indicacionId: ind.id,
      paciente: ind.paciente,
      insumo: ind.insumo,
      dosis: ind.dosis,
      frecuencia: ind.frecuencia,
      stock: item ? `${item.cantidadDisponible} ${item.unidadMedida}` : '—',
    };
    if (ind.dosisDelDia.length === 0) {
      return [{ ...base, key: ind.id, hora: '—', estado: null, enVentana: false, detalle: 'Sin dosis programadas hoy' }];
    }
    return ind.dosisDelDia.map((d): DoseRow => ({
      ...base,
      key: `${ind.id}-${d.programadaPara}`,
      hora: time(d.programadaPara),
      estado: d.estado,
      enVentana: d.enVentana,
      detalle: d.administradaPor ? `Administrada por ${d.administradaPor}` : '',
    }));
  }),
);

function reload(): Promise<unknown> {
  return Promise.all([load(selectedPatient.value || undefined), inventory.load()]);
}

async function register(row: DoseRow): Promise<void> {
  administeringId.value = row.indicacionId;
  actionError.value = null;
  actionOk.value = null;
  try {
    await administer(row.indicacionId);
    actionOk.value = `Administración registrada: ${row.insumo} a ${row.paciente}.`;
  } catch (e) {
    actionError.value =
      e instanceof ApiError && e.status === 409
        ? `No se pudo registrar: ${e.message}`
        : e instanceof ApiError
          ? e.message
          : 'No se pudo registrar la administración.';
  } finally {
    administeringId.value = null;
    // Se vuelve a consultar siempre: el estado de la dosis y el stock (descontado por el backend) pueden haber cambiado.
    await reload();
  }
}

onMounted(() => Promise.all([loadPatients(), reload()]));
</script>

<template>
  <div>
    <div class="toolbar">
      <label>
        Paciente
        <select v-model="selectedPatient" :disabled="loading" @change="reload">
          <option value="">Todos los pacientes</option>
          <option v-for="p in patients" :key="p.id" :value="p.id">{{ p.apellido }}, {{ p.nombre }} ({{ p.documento }})</option>
        </select>
      </label>
      <button type="button" :disabled="loading" @click="reload">Actualizar</button>
    </div>
    <p v-if="patientsError" class="error" role="alert">
      {{ patientsError }} <button type="button" @click="loadPatients">Reintentar</button>
    </p>

    <p class="summary">{{ pendingCount }} dosis pendientes de {{ totalDoses }} programadas hoy.</p>
    <p v-if="!canAdminister" class="summary">Solo el personal de enfermería puede registrar administraciones.</p>

    <p v-if="actionError" class="error" role="alert">{{ actionError }}</p>
    <p v-if="actionOk" class="ok" role="status">{{ actionOk }}</p>
    <p v-if="inventory.error.value" class="error" role="alert">
      {{ inventory.error.value }} (no se muestra el stock actual)
    </p>

    <p v-if="error" class="error" role="alert">
      {{ error }} <button type="button" :disabled="loading" @click="reload">Reintentar</button>
    </p>
    <p v-else-if="loading && indications.length === 0" role="status">Cargando indicaciones...</p>
    <p v-else-if="indications.length === 0">No hay indicaciones activas{{ selectedPatient ? ' para este paciente' : '' }}.</p>
    <DataTable v-else :data="rows" :columns="columns">
      <template #cell-estado="{ row }">
        <StatusChip v-if="row.estado === null" label="Sin dosis hoy" tone="neutral" />
        <StatusChip v-else-if="row.estado === 'ADMINISTRADA'" label="Administrada" tone="success" />
        <StatusChip v-else :label="row.enVentana ? 'Pendiente (en ventana)' : 'Pendiente'" :tone="row.enVentana ? 'warning' : 'info'" />
        <small v-if="row.detalle" class="detail">{{ row.detalle }}</small>
      </template>
      <template #cell-accion="{ row }">
        <button
          v-if="row.estado === 'PENDIENTE'"
          type="button"
          :disabled="!canAdminister || !row.enVentana || administeringId !== null"
          :title="!canAdminister ? 'Solo enfermería puede registrar administraciones' : !row.enVentana ? 'Fuera de la ventana de ±30 min' : ''"
          @click="register(row)"
        >
          {{ administeringId === row.indicacionId ? 'Registrando...' : 'Registrar administración' }}
        </button>
      </template>
    </DataTable>
  </div>
</template>

<style scoped>
.toolbar { display: flex; align-items: end; flex-wrap: wrap; gap: var(--space-3); margin-bottom: var(--space-3); }
.toolbar label { display: grid; gap: var(--space-1); font-size: 0.9rem; }
select { font: inherit; padding: 8px; border: 1px solid var(--color-border); border-radius: 8px; min-width: 260px; }
.summary { color: var(--color-muted); margin-top: 0; }
.detail { display: block; color: var(--color-muted); }
:deep(.data-table) { width: 100%; border-collapse: collapse; background: var(--color-surface); }
:deep(.data-table th), :deep(.data-table td) { padding: var(--space-2) var(--space-3); text-align: left; border-bottom: 1px solid var(--color-border); }
:deep(.data-table th) { color: var(--color-muted); font-size: 0.8rem; }
:deep(.data-table tbody tr:hover) { background: #f1f5f9; }
button { font: inherit; padding: 6px 10px; border: 1px solid var(--color-border); border-radius: 8px;
  background: transparent; cursor: pointer; }
button:hover:not(:disabled) { background: #e6eefb; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
.error { color: var(--color-danger); }
.ok { color: var(--color-success); }
</style>
