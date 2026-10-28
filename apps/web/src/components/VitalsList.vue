<script setup lang="ts">
import type { VitalSign } from '../services/vitalSigns';
import { formatTime } from '../shared/format';
import StatusChip from './ui/StatusChip.vue';

defineProps<{ records: VitalSign[]; empty?: string }>();
</script>

<template>
  <p v-if="records.length === 0" class="muted">{{ empty ?? 'Todavía no hay registros.' }}</p>
  <ul v-else class="list">
    <li v-for="r in records" :key="r.id" :class="{ 'critical-row': r.critico }">
      <div class="who">
        <strong>{{ r.paciente }}</strong>
        <small>PA {{ r.sistolica }}/{{ r.diastolica }} · FC {{ r.frecuenciaCardiaca }} lpm · {{ r.temperatura }} °C</small>
      </div>
      <div class="end">
        <StatusChip v-if="r.critico" label="Crítico" tone="danger" />
        <small>{{ formatTime(r.fechaHora) }}</small>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.end { display: grid; justify-items: end; gap: 4px; }
</style>
