<script setup lang="ts">
import { ref, computed } from 'vue';
import StatusChip from '@/components/ui/StatusChip.vue';

const triajes = ref([
  { id: 1, paciente: 'Luis Torres', prioridad: 3 },
  { id: 2, paciente: 'Sofia Castro', prioridad: 1 }, // Urgencia alta
]);

//  prioridad (1 = urgente)
const triajeOrdenado = computed(() => {
  return [...triajes.value].sort((a, b) => a.prioridad - b.prioridad);
});
</script>

<template>
  <div class="triage-queue">
    <h3>Cola de Triaje</h3>
    <ul>
      <li v-for="t in triajeOrdenado" :key="t.id">
        <span>{{ t.paciente }}</span>
        <StatusChip :label="`Prioridad ${t.prioridad}`" tone="danger" />
      </li>
    </ul>
  </div>
</template>