<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import StatCard from '@/components/ui/StatCard.vue';
import { useDashboardStore } from '@/stores/dashboard.store';
import { useMedications } from '@/composables/useMedications';

const { occupiedBeds, totalBeds, todayAppointments, triage, canSeeAgenda, canSeeVitals } = storeToRefs(useDashboardStore());
const meds = useMedications();
// Las indicaciones solo las puede consultar enfermería o medicina (el administrativo recibiría 403).
onMounted(() => { if (canSeeVitals.value) void meds.load(); });

const bedsLabel = computed(() => `${occupiedBeds.value} de ${totalBeds.value}`);
const occupancy = computed(() =>
  totalBeds.value ? Math.round((occupiedBeds.value / totalBeds.value) * 100) : 0,
);
const highPriority = computed(() => triage.value.filter((t) => t.prioridad === 'ALTA').length);
</script>

<template>
  <div class="summary-cards">
    <StatCard titulo="Turnos de hoy" icon="📅" tone="info"
      :valor="canSeeAgenda ? todayAppointments.length : '—'"
      :detalle="canSeeAgenda ? 'Agenda del día' : 'Sin acceso a la agenda'" />
    <StatCard titulo="En cola de triaje" icon="🧑‍⚕️" tone="warning"
      :valor="triage.length" :detalle="`${highPriority} prioridad alta`" />
    <StatCard titulo="Camas ocupadas" icon="🛏️" tone="accent"
      :valor="bedsLabel" :progress="occupancy" :detalle="`${occupancy}% de ocupación`" />
    <StatCard titulo="Medicaciones pendientes" icon="💊" tone="violet"
      :valor="canSeeVitals ? meds.pendingCount.value : '—'"
      :detalle="canSeeVitals ? 'Dosis de hoy para administrar' : 'Sin acceso a la medicación'" />
  </div>
</template>

<style scoped>
.summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-3); }
</style>