<script setup lang="ts">
import { ref } from 'vue';
import SummaryCards from './components/SummaryCards.vue';
import UpcomingAppointments from './components/UpcomingAppointments.vue';
import TriageQueue from './components/TriageQueue.vue';
import BedMap from './components/BedMap.vue';
import VitalsCard from './components/VitalsCard.vue';
import StockCard from './components/StockCard.vue';

const session = ref({
  fullName: 'Dra. María Pérez'
});

const handleSelectCama = (cama: any) => {
  console.log('Cama seleccionada:', cama);
};
</script>

<template>
  <div class="dashboard-view">
    <h2>¡Hola, {{ session.fullName }}!</h2>
    
    <SummaryCards />
    
    <div class="dashboard-grid">
      <UpcomingAppointments />
      <TriageQueue />
    </div>

    <BedMap @select="handleSelectCama" />

    <div class="dashboard-row">
      <VitalsCard />
      <StockCard />
    </div>
  </div>
</template>