<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import AppIcon from '../../components/ui/AppIcon.vue';
import BaseCard from '../../components/ui/BaseCard.vue';
import NoticeBanner from '../../components/ui/NoticeBanner.vue';
import PageHeader from '../../components/ui/PageHeader.vue';
import StatCard from '../../components/ui/StatCard.vue';
import StatusChip from '../../components/ui/StatusChip.vue';
import { useCharges } from '../../composables/useCharges';
import type { Charge, TipoAtencion } from '../../services/charges';
import { formatDateTime, formatMoney } from '../../shared/format';
import ChargeDetailPanel from './ChargeDetailPanel.vue';
import {
  buildChargesCsv,
  CONCEPTO,
  coverageLabel,
  doctorName,
  downloadCsv,
  hasCoverage,
  inPeriod,
  PERIODO_LABEL,
  patientName,
  shortId,
  TIPO_LABEL,
  type Periodo,
} from './charge-ui';

const PAGE_SIZE = 10;

const { charges, loading, error, load } = useCharges();
const periodo = ref<Periodo>('TODO');
const tipo = ref<'' | TipoAtencion>('');
const busqueda = ref('');
const pagina = ref(1);
const seleccionado = ref<Charge | null>(null);
const detalleAbierto = ref(false);

const delPeriodo = computed(() => charges.value.filter((c) => inPeriod(c.createdAt, periodo.value)));
const importeTotal = computed(() => delPeriodo.value.reduce((sum, c) => sum + c.importePesos, 0));
const conCobertura = computed(() => delPeriodo.value.filter(hasCoverage).length);
const porcentajeCobertura = computed(() =>
  delPeriodo.value.length ? Math.round((conCobertura.value / delPeriodo.value.length) * 100) : 0,
);
const aCargoPaciente = computed(() => delPeriodo.value.reduce((sum, c) => sum + (c.cobertura?.pacientePesos ?? 0), 0));
const aCargoTerceros = computed(() => delPeriodo.value.reduce((sum, c) => sum + (c.cobertura?.terceroPesos ?? 0), 0));

const filtrados = computed(() => {
  const text = busqueda.value.trim().toLowerCase();
  return delPeriodo.value
    .filter((c) => !tipo.value || c.tipoAtencion === tipo.value)
    .filter(
      (c) =>
        !text ||
        `${patientName(c)} ${c.turno?.paciente?.documento ?? ''} ${doctorName(c)} ${coverageLabel(c)} ${c.id} ${c.turnoId}`
          .toLowerCase()
          .includes(text),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
});

const totalPaginas = computed(() => Math.max(1, Math.ceil(filtrados.value.length / PAGE_SIZE)));
const visibles = computed(() => filtrados.value.slice((pagina.value - 1) * PAGE_SIZE, pagina.value * PAGE_SIZE));
const desde = computed(() => (filtrados.value.length ? (pagina.value - 1) * PAGE_SIZE + 1 : 0));
const hasta = computed(() => Math.min(pagina.value * PAGE_SIZE, filtrados.value.length));

watch([periodo, tipo, busqueda], () => (pagina.value = 1));

function abrir(charge: Charge): void {
  seleccionado.value = charge;
  detalleAbierto.value = true;
}

function exportar(): void {
  const hoy = new Date().toISOString().slice(0, 10);
  downloadCsv(`cargos-${hoy}.csv`, buildChargesCsv(filtrados.value));
}

onMounted(load);
</script>

<template>
  <div class="page">
    <PageHeader title="Facturación" subtitle="Gestión y seguimiento de cargos por atenciones.">
      <select v-model="periodo" aria-label="Período" class="filter">
        <option v-for="(label, key) in PERIODO_LABEL" :key="key" :value="key">{{ label }}</option>
      </select>
      <button class="btn btn-secondary" type="button" :disabled="filtrados.length === 0" @click="exportar">
        Exportar CSV
      </button>
    </PageHeader>

    <div class="stats">
      <StatCard titulo="Cargos del período" :valor="delPeriodo.length" detalle="Atenciones facturadas" tone="info" />
      <StatCard
        titulo="Importe facturado"
        :valor="formatMoney(importeTotal)"
        :detalle="`Paciente ${formatMoney(aCargoPaciente)} · Terceros ${formatMoney(aCargoTerceros)}`"
        tone="brand"
      />
      <StatCard titulo="Con cobertura" :valor="`${porcentajeCobertura}%`" :detalle="`${conCobertura} cargos con obra social o prepaga`" tone="violet" />
    </div>

    <BaseCard>
      <template #header>
        <div class="toolbar">
          <div>
            <h3>Detalle de cargos</h3>
            <p class="muted">Seleccioná una fila para consultar el detalle y su origen.</p>
          </div>
          <div class="filters">
            <label class="search">
              <AppIcon name="search" :size="16" class="lead" />
              <input v-model="busqueda" type="search" placeholder="Buscar paciente, médico o ID" aria-label="Buscar cargo" />
            </label>
            <select v-model="tipo" aria-label="Tipo de cargo" class="filter">
              <option value="">Todos los cargos</option>
              <option value="REGULAR">{{ TIPO_LABEL.REGULAR }}</option>
              <option value="URGENCIA">{{ TIPO_LABEL.URGENCIA }}</option>
            </select>
          </div>
        </div>
      </template>

      <NoticeBanner v-if="error" tone="error">
        {{ error }} <button type="button" class="btn-sm" :disabled="loading" @click="load">Reintentar</button>
      </NoticeBanner>
      <p v-else-if="loading && charges.length === 0" role="status">Cargando cargos...</p>
      <p v-else-if="charges.length === 0" class="muted">
        Todavía no hay cargos. Se generan al marcar un turno como atendido.
      </p>
      <p v-else-if="filtrados.length === 0" class="muted">No hay cargos que coincidan con los filtros.</p>
      <template v-else>
        <div class="scroll-x">
          <table class="charges">
            <thead>
              <tr>
                <th>Paciente</th><th>Concepto</th><th>Tipo de cargo</th><th>Cobertura</th>
                <th class="num">Valor base</th><th></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="c in visibles"
                :key="c.id"
                tabindex="0"
                @click="abrir(c)"
                @keydown.enter="abrir(c)"
              >
                <td><strong>{{ patientName(c) }}</strong><small>ID de cargo: {{ shortId(c.id) }}</small></td>
                <td>{{ CONCEPTO[c.tipoAtencion] }}<small>{{ c.turno ? formatDateTime(c.turno.fechaHora) : '—' }} · {{ doctorName(c) }}</small></td>
                <td>
                  <StatusChip :label="TIPO_LABEL[c.tipoAtencion]" :tone="c.tipoAtencion === 'URGENCIA' ? 'warning' : 'info'" />
                </td>
                <td :class="{ quiet: !c.cobertura }">{{ coverageLabel(c) }}</td>
                <td class="num"><strong>{{ formatMoney(c.importePesos) }}</strong></td>
                <td class="go"><AppIcon name="chevron-right" :size="17" /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="pagination">
          <span>Mostrando {{ desde }}–{{ hasta }} de {{ filtrados.length }} cargos</span>
          <div>
            <button class="btn btn-sm btn-secondary" type="button" :disabled="pagina === 1" @click="pagina--">Anterior</button>
            <button class="btn btn-sm btn-secondary" type="button" :disabled="pagina >= totalPaginas" @click="pagina++">Siguiente</button>
          </div>
        </div>
      </template>
    </BaseCard>

    <ChargeDetailPanel :open="detalleAbierto" :charge="seleccionado" @close="detalleAbierto = false" />
  </div>
</template>

<style scoped>
.filter { width: auto; }
.toolbar { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; width: 100%; }
.toolbar h3, .toolbar p { margin: 0; }
.filters { display: flex; gap: 8px; flex-wrap: wrap; }
.search { position: relative; display: block; }
.search input { padding-left: 36px; min-width: 250px; }
.search .lead { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--color-muted); pointer-events: none; }
.charges tbody tr { cursor: pointer; }
.charges tbody tr:hover, .charges tbody tr:focus-visible { background: var(--color-brand-soft); outline: none; }
.charges td small { display: block; color: var(--color-muted); font-size: 0.75rem; }
.num { text-align: right; }
.quiet { color: #8a9692; }
.go { width: 32px; color: var(--color-muted); }
.pagination { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 14px; color: var(--color-muted); font-size: 0.85rem; }
.pagination div { display: flex; gap: 8px; }
</style>
