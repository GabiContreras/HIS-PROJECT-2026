<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import BaseCard from '../../components/ui/BaseCard.vue';
import NoticeBanner from '../../components/ui/NoticeBanner.vue';
import PageHeader from '../../components/ui/PageHeader.vue';
import StatCard from '../../components/ui/StatCard.vue';
import StatusChip from '../../components/ui/StatusChip.vue';
import { useCharges } from '../../composables/useCharges';
import { formatDateTime, formatMoney } from '../../shared/format';

const { charges, loading, error, total, urgentCount, load } = useCharges();
const type = ref<'' | 'REGULAR' | 'URGENCIA'>('');

const visible = computed(() =>
  (type.value ? charges.value.filter((c) => c.tipoAtencion === type.value) : charges.value)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
);

onMounted(load);
</script>

<template>
  <div class="page">
    <PageHeader title="Facturación" subtitle="Cargos generados automáticamente cuando un turno pasa a Atendido.">
      <select v-model="type" aria-label="Tipo de atención" class="filter">
        <option value="">Todas las atenciones</option>
        <option value="REGULAR">Regular</option>
        <option value="URGENCIA">Urgencia</option>
      </select>
    </PageHeader>

    <div class="stats">
      <StatCard titulo="Total facturado" :valor="formatMoney(total)" detalle="Suma de todos los cargos" tone="brand" />
      <StatCard titulo="Cargos emitidos" :valor="charges.length" detalle="Turnos facturados" tone="info" />
      <StatCard titulo="Urgencias" :valor="urgentCount" detalle="Atenciones de urgencia" tone="warning" />
    </div>

    <BaseCard>
      <template #header><h3>Detalle de cargos</h3></template>
      <NoticeBanner v-if="error" tone="error">
        {{ error }} <button type="button" class="btn-sm" :disabled="loading" @click="load">Reintentar</button>
      </NoticeBanner>
      <p v-else-if="loading" role="status">Cargando cargos...</p>
      <p v-else-if="visible.length === 0" class="muted">Todavía no hay cargos. Se generan al marcar un turno como atendido.</p>
      <div v-else class="scroll-x">
        <table>
          <thead><tr><th>Fecha</th><th>Turno</th><th>Tipo</th><th>Importe</th></tr></thead>
          <tbody>
            <tr v-for="c in visible" :key="c.id">
              <td>{{ formatDateTime(c.createdAt) }}</td>
              <td><code>{{ c.turnoId.slice(0, 8) }}</code></td>
              <td>
                <StatusChip :label="c.tipoAtencion === 'URGENCIA' ? 'Urgencia' : 'Regular'" :tone="c.tipoAtencion === 'URGENCIA' ? 'warning' : 'info'" />
              </td>
              <td><strong>{{ formatMoney(c.importePesos) }}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </BaseCard>
  </div>
</template>

<style scoped>
.filter { width: auto; }
</style>
