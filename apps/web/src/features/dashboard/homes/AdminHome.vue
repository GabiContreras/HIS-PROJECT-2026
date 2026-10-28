<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { RouterLink, useRouter } from 'vue-router';
import BedsOverview from '../../../components/BedsOverview.vue';
import StockList from '../../../components/StockList.vue';
import BaseCard from '../../../components/ui/BaseCard.vue';
import NoticeBanner from '../../../components/ui/NoticeBanner.vue';
import PageHeader from '../../../components/ui/PageHeader.vue';
import StatCard from '../../../components/ui/StatCard.vue';
import StatusChip from '../../../components/ui/StatusChip.vue';
import { useCharges } from '../../../composables/useCharges';
import type { Bed } from '../../../services/beds';
import { formatMoney, formatTime, greeting, isToday, longDate } from '../../../shared/format';
import { useBedsStore } from '../../../stores/beds.store';
import { useInventoryStore } from '../../../stores/inventory.store';
import { doctorName, ESTADO_LABELS, ESTADO_TONES, patientName } from '../../admissions/appointment-ui';
import { useAppointments } from '../../admissions/useAppointments';
import { useSessionStore } from '../../iam/session.store';

const session = useSessionStore();
const router = useRouter();
const agenda = useAppointments();
const charges = useCharges();
const beds = useBedsStore();
const inventory = useInventoryStore();
const { lowStock, items } = storeToRefs(inventory);

const today = computed(() =>
  agenda.turnos.value.filter((t) => isToday(t.fechaHora)).sort((a, b) => a.fechaHora.localeCompare(b.fechaHora)),
);
const upcoming = computed(() => today.value.filter((t) => t.estado !== 'CANCELADO').slice(0, 6));
const occupancy = computed(() => (beds.total ? Math.round((beds.occupied / beds.total) * 100) : 0));

function openBed(bed: Bed): void {
  void router.push({ name: 'bed-detail', params: { id: bed.id } });
}

onMounted(() => Promise.all([agenda.cargar(), charges.load(), beds.load(), inventory.load()]));
</script>

<template>
  <div class="page">
    <PageHeader :title="greeting(session.account?.nombre)" :subtitle="`Resumen del hospital para hoy, ${longDate()}.`">
      <RouterLink class="btn" :to="{ name: 'patients', query: { nuevo: '1' } }">Registrar paciente</RouterLink>
      <RouterLink class="btn btn-secondary" :to="{ name: 'appointments' }">Ir a la agenda</RouterLink>
    </PageHeader>

    <NoticeBanner v-if="agenda.error.value" tone="error">
      No se pudo cargar la agenda: {{ agenda.error.value }}
      <button type="button" class="btn-sm" @click="agenda.cargar">Reintentar</button>
    </NoticeBanner>

    <div class="stats">
      <StatCard titulo="Turnos de hoy" :valor="today.length" detalle="Agenda de todos los médicos" tone="info" />
      <StatCard titulo="Camas ocupadas" :valor="`${beds.occupied} de ${beds.total}`" :detalle="`${occupancy}% de ocupación`" tone="brand" />
      <StatCard titulo="Insumos con stock bajo" :valor="lowStock.length" detalle="Reponer cuanto antes" tone="warning" />
      <StatCard
        titulo="Total facturado"
        :valor="charges.error.value ? '—' : formatMoney(charges.total.value)"
        :detalle="`${charges.charges.value.length} cargos emitidos`"
        tone="violet"
      />
    </div>

    <div class="grid-2">
      <BaseCard>
        <template #header><h3>Próximos turnos</h3></template>
        <template #action><RouterLink :to="{ name: 'appointments' }">Ver agenda completa →</RouterLink></template>
        <p v-if="agenda.cargando.value" role="status">Cargando turnos...</p>
        <p v-else-if="upcoming.length === 0" class="muted">No hay turnos para hoy.</p>
        <div v-else class="scroll-x">
          <table>
            <thead><tr><th>Hora</th><th>Paciente</th><th>Médico</th><th>Estado</th></tr></thead>
            <tbody>
              <tr v-for="t in upcoming" :key="t.id">
                <td><strong>{{ formatTime(t.fechaHora) }}</strong></td>
                <td>{{ patientName(t) }}</td>
                <td>{{ doctorName(t) }}</td>
                <td><StatusChip :label="ESTADO_LABELS[t.estado]" :tone="ESTADO_TONES[t.estado]" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </BaseCard>

      <BaseCard>
        <template #header><h3>Stock de insumos</h3></template>
        <template #action><RouterLink :to="{ name: 'inventory' }">Ver insumos →</RouterLink></template>
        <StockList :items="items" :limit="5" />
      </BaseCard>
    </div>

    <BaseCard>
      <template #header><h3>Mapa de camas</h3></template>
      <template #action><RouterLink :to="{ name: 'beds' }">Gestionar camas →</RouterLink></template>
      <BedsOverview @select="openBed" />
    </BaseCard>
  </div>
</template>
