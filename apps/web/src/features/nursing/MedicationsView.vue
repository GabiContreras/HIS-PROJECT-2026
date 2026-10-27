<script setup lang="ts">
import { onMounted } from 'vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { useMedications } from '@/composables/useMedications';

const { medications, pending, loading, error, load, administer } = useMedications();

onMounted(load);
</script>

<template>
  <div>
    <p class="summary">{{ pending.length }} medicaciones pendientes de {{ medications.length }}.</p>

    <p v-if="error" class="error" role="alert">
      {{ error }} <button type="button" :disabled="loading" @click="load">Reintentar</button>
    </p>
    <p v-else-if="loading && medications.length === 0" role="status">Cargando medicaciones...</p>
    <p v-else-if="medications.length === 0">No hay medicaciones indicadas.</p>
    <table v-else>
      <thead>
        <tr><th>Horario</th><th>Paciente</th><th>Medicamento</th><th>Dosis</th><th>Estado</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="m in medications" :key="m.id">
          <td>{{ m.horario }}</td>
          <td>{{ m.paciente }}</td>
          <td>{{ m.medicamento }}</td>
          <td>{{ m.dosis }}</td>
          <td>
            <StatusChip
              :label="m.estado === 'PENDIENTE' ? 'Pendiente' : 'Administrada'"
              :tone="m.estado === 'PENDIENTE' ? 'warning' : 'success'"
            />
          </td>
          <td>
            <button v-if="m.estado === 'PENDIENTE'" type="button" :disabled="loading" @click="administer(m.id)">
              Marcar administrada
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.summary { color: var(--color-muted); margin-top: 0; }
table { width: 100%; border-collapse: collapse; background: var(--color-surface); }
th, td { padding: var(--space-2) var(--space-3); text-align: left; border-bottom: 1px solid var(--color-border); }
th { color: var(--color-muted); font-size: 0.8rem; }
tbody tr:hover { background: #f1f5f9; }
td button { font: inherit; padding: 6px 10px; border: 1px solid var(--color-border); border-radius: 8px;
  background: transparent; cursor: pointer; }
td button:hover:not(:disabled) { background: #e6eefb; }
.error { color: var(--color-danger); }
</style>