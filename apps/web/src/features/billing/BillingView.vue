<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import StatCard from '@/components/ui/StatCard.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { useCharges } from '@/composables/useCharges';

const { charges, loading, error, total, urgentCount, load } = useCharges();
const type = ref<'' | 'REGULAR' | 'URGENCIA'>('');

const visible = computed(() =>
  (type.value ? charges.value.filter((c) => c.tipoAtencion === type.value) : charges.value)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
);

const money = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
const date = (iso: string) => new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });

onMounted(load);
</script>

<template>
  <section class="page">
    <header class="head">
      <div>
        <h1>Facturación</h1>
        <p>Cargos generados por turnos atendidos.</p>
      </div>
      <label class="filter">
        Tipo de atención
        <select v-model="type">
          <option value="">Todos</option>
          <option value="REGULAR">Regular</option>
          <option value="URGENCIA">Urgencia</option>
        </select>
      </label>
    </header>

    <div class="stats">
      <StatCard titulo="Total facturado" icon="💰" tone="accent" :valor="money(total)" detalle="Suma de todos los cargos" />
      <StatCard titulo="Cargos emitidos" icon="🧾" tone="info" :valor="charges.length" detalle="Turnos facturados" />
      <StatCard titulo="Urgencias" icon="🚑" tone="warning" :valor="urgentCount" detalle="Atenciones de urgencia" />
    </div>

    <BaseCard>
      <template #header><h3>Detalle de cargos</h3></template>
      <p v-if="error" class="error" role="alert">
        {{ error }} <button type="button" :disabled="loading" @click="load">Reintentar</button>
      </p>
      <p v-else-if="loading" role="status">Cargando cargos...</p>
      <p v-else-if="visible.length === 0" class="muted">
        Todavía no hay cargos. Se generan automáticamente al marcar un turno como atendido.
      </p>
      <table v-else>
        <thead><tr><th>Fecha</th><th>Turno</th><th>Tipo</th><th>Importe</th></tr></thead>
        <tbody>
          <tr v-for="c in visible" :key="c.id">
            <td>{{ date(c.createdAt) }}</td>
            <td><code>{{ c.turnoId.slice(0, 8) }}</code></td>
            <td>
              <StatusChip
                :label="c.tipoAtencion === 'URGENCIA' ? 'Urgencia' : 'Regular'"
                :tone="c.tipoAtencion === 'URGENCIA' ? 'warning' : 'info'"
              />
            </td>
            <td><strong>{{ money(c.importePesos) }}</strong></td>
          </tr>
        </tbody>
      </table>
    </BaseCard>
  </section>
</template>

<style scoped>
.page { display: grid; gap: var(--space-4); }
.head { display: flex; justify-content: space-between; align-items: end; flex-wrap: wrap; gap: var(--space-3); }
.head h1, .head p, h3 { margin: 0; }
.head p, .muted { color: var(--color-muted); }
.filter { display: grid; gap: var(--space-1); font-size: 0.9rem; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-3); }
tbody tr:hover { background: #f1f5f9; }
.error { color: var(--color-danger); }
</style>