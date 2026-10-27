<script setup lang="ts">
import { ref } from 'vue';
import StatusChip from '@/components/ui/StatusChip.vue';

const appointments = ref([
  { id: 1, paciente: 'Ana Gómez', hora: '09:00', estado: 'Confirmado' },
  { id: 2, paciente: 'Carlos Ruiz', hora: '09:30', estado: 'Pendiente' },
]);

const getTone = (estado: string): 'success' | 'warning' | 'neutral' => {
  if (estado === 'Confirmado') return 'success';
  if (estado === 'Pendiente') return 'warning';
  return 'neutral';
};
</script>

<template>
  <div class="upcoming-appointments">
    <h3>Próximos Turnos</h3>
    <table>
      <tr v-for="item in appointments" :key="item.id" class="row-hover">
        <td>{{ item.hora }}</td>
        <td>{{ item.paciente }}</td>
        <td>
          <StatusChip :label="item.estado" :tone="getTone(item.estado)" />
        </td>
      </tr>
    </table>
  </div>
</template>

<style scoped>
.row-hover:hover {
  background-color: #f1f5f9;
  cursor: pointer;
}
</style>