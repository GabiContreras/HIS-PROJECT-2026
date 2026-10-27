<script setup lang="ts">
import { storeToRefs } from 'pinia';
import BaseCard from '@/components/ui/BaseCard.vue';
import BedGrid from '@/components/BedGrid.vue';
import { BED_STATUS_LABELS, type Bed, type BedStatus } from '@/services/beds';
import { useDashboardStore } from '@/stores/dashboard.store';

const emit = defineEmits<{ select: [bed: Bed] }>();
const { beds, loading } = storeToRefs(useDashboardStore());
const STATUSES = Object.keys(BED_STATUS_LABELS) as BedStatus[];
</script>

<template>
  <BaseCard>
    <template #header><h3>Mapa de camas</h3></template>
    <p v-if="loading && beds.length === 0" role="status">Cargando camas...</p>
    <template v-else>
      <BedGrid :beds="beds" @select="emit('select', $event)" />
      <ul class="legend">
        <li v-for="s in STATUSES" :key="s">
          <span class="dot" :class="`dot-${s.toLowerCase()}`"></span>{{ BED_STATUS_LABELS[s] }}
        </li>
      </ul>
    </template>
  </BaseCard>
</template>

<style scoped>
h3 { margin: 0; }
.legend { display: flex; flex-wrap: wrap; gap: var(--space-3); list-style: none; padding: 0; margin: var(--space-3) 0 0; font-size: 0.9rem; }
.dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 6px; }
.dot-disponible { background: var(--cama-disponible); }
.dot-ocupada { background: var(--cama-ocupada); }
.dot-reservada { background: var(--cama-reservada); }
.dot-mantenimiento { background: var(--cama-mantenimiento); }
</style>