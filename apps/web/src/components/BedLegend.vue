<script setup lang="ts">
import { BED_STATUS_LABELS, type BedStatus } from '../services/beds';

defineProps<{ counts?: Partial<Record<BedStatus, number>> }>();
const STATUSES = Object.keys(BED_STATUS_LABELS) as BedStatus[];
</script>

<template>
  <ul class="legend">
    <li v-for="s in STATUSES" :key="s">
      <span class="dot" :class="`dot-${s.toLowerCase()}`"></span>
      {{ BED_STATUS_LABELS[s] }}<template v-if="counts"> ({{ counts[s] ?? 0 }})</template>
    </li>
  </ul>
</template>

<style scoped>
.legend { display: flex; flex-wrap: wrap; gap: 6px 18px; list-style: none; padding: 0; margin: 0; font-size: 0.82rem; }
.dot { display: inline-block; width: 11px; height: 11px; border-radius: 50%; margin-right: 6px; }
.dot-disponible { background: var(--cama-disponible); }
.dot-ocupada { background: var(--cama-ocupada); }
.dot-en_limpieza { background: var(--cama-limpieza); }
.dot-mantenimiento { background: var(--cama-bloqueada); }
</style>
