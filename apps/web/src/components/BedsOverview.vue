<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useBedsStore } from '../stores/beds.store';
import type { Bed } from '../services/beds';
import BedGrid from './BedGrid.vue';
import BedLegend from './BedLegend.vue';

const emit = defineEmits<{ select: [bed: Bed] }>();
const { beds, counts, loading } = storeToRefs(useBedsStore());
</script>

<template>
  <p v-if="loading && beds.length === 0" role="status">Cargando camas...</p>
  <div v-else class="overview">
    <BedGrid :beds="beds" @select="emit('select', $event)" />
    <BedLegend :counts="counts" />
  </div>
</template>

<style scoped>
.overview { display: grid; gap: 14px; }
</style>
