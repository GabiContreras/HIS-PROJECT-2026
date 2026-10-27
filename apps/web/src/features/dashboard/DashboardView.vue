<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useSessionStore } from '../iam/session.store';
import type { Bed } from '../../services/beds';
import SummaryCards from './components/SummaryCards.vue';
import UpcomingAppointments from './components/UpcomingAppointments.vue';
import TriageQueue from './components/TriageQueue.vue';
import BedMap from './components/BedMap.vue';
import VitalsCard from './components/VitalsCard.vue';
import StockCard from './components/StockCard.vue';
import { useDashboardStore } from '../../stores/dashboard.store';
// import { storeToRefs } from 'pinia';
// const { occupiedBeds, totalBeds, todayAppointments } = storeToRefs(useDashboardStore());

const dashboard = useDashboardStore();
onMounted(dashboard.load);

const session = useSessionStore();
const router = useRouter();


const greeting = computed(() => {
  const hour = new Date().getHours();
  const salutation = hour < 12 ? 'Buen día' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  const name = session.account?.nombre ?? '';
  return name ? `${salutation}, ${name}` : salutation;
});
const today = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

function openBed(bed: Bed): void {
  void router.push({ name: 'bed-detail', params: { id: bed.id } });
}
</script>

<template>
  <div class="dashboard-view">
    <header class="dashboard-head">
  <div>
    <h1>{{ greeting }}</h1>
    <p>Resumen del hospital para hoy.</p>
  </div>
  <span class="date">{{ today }}</span>
</header>
    <p v-if="dashboard.error" class="error" role="alert">
  {{ dashboard.error }} <button type="button" @click="dashboard.load">Reintentar</button>
</p>
    <SummaryCards />

    <div class="dashboard-grid">
      <UpcomingAppointments />
      <TriageQueue />
    </div>

    <BedMap @select="openBed" />

    <div class="dashboard-row">
      <VitalsCard />
      <StockCard />
    </div>
  </div>
</template>

<style scoped>
.dashboard-view { display: grid; gap: var(--space-4); }
.dashboard-head h1, .dashboard-head p { margin: 0; }
.dashboard-head p { color: var(--color-muted); margin-top: var(--space-1); }
.dashboard-grid { display: grid; grid-template-columns: 2fr 1fr; gap: var(--space-4); }

.dashboard-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-4); }
.dashboard-grid > *, .dashboard-row > * { min-width: 0; }
.error { color: var(--color-danger); }

@media (max-width: 900px) {
  .dashboard-grid, .dashboard-row { grid-template-columns: 1fr; }
}
</style>