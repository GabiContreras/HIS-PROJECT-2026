<script setup lang="ts">
import { TRIAGE_LABELS, type TriageEntry, type TriageLevel } from '../services/triage';
import { minutesSince } from '../shared/format';
import StatusChip, { type ChipTone } from './ui/StatusChip.vue';

defineProps<{ entries: TriageEntry[]; limit?: number }>();

const TONES: Record<TriageLevel, ChipTone> = { ROJO: 'danger', AMARILLO: 'warning', VERDE: 'success' };
const SHORT: Record<TriageLevel, string> = { ROJO: 'Rojo', AMARILLO: 'Urgente', VERDE: 'No urgente' };
</script>

<template>
  <p v-if="entries.length === 0" class="muted">No hay pacientes en espera.</p>
  <ul v-else class="list">
    <li v-for="entry in entries.slice(0, limit ?? entries.length)" :key="entry.id" :class="{ 'critical-row': entry.nivel === 'ROJO' }">
      <div class="who">
        <strong>{{ entry.paciente }}</strong>
        <small>{{ entry.motivo }} · espera {{ minutesSince(entry.llegadaAt) }} min</small>
      </div>
      <StatusChip :label="SHORT[entry.nivel]" :tone="TONES[entry.nivel]" :title="TRIAGE_LABELS[entry.nivel]" />
    </li>
  </ul>
</template>
