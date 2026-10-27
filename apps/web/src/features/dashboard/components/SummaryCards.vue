<script setup lang="ts">
import StatCard from '@/components/ui/StatCard.vue';
import { useDashboardStore } from '@/stores/dashboard.store';
import { onMounted } from 'vue';

const dashboardStore = useDashboardStore();
onMounted(() => {
  dashboardStore.cargarDatos();
});
</script>

<template>
  <div class="summary-cards">
    <StatCard titulo="Total de Camas" :valor="dashboardStore.totalCamas" detalle="Hospital general" />
    <StatCard titulo="Camas Ocupadas" :valor="dashboardStore.camasOcupadas" detalle="En uso actual" />
    <StatCard titulo="Turnos de Hoy" valor="12" detalle="Programados" />
    <StatCard titulo="Emergencias" valor="3" detalle="En triaje" />
  </div>
</template>