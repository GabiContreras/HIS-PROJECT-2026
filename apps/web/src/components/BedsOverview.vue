<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useBedsRealtime } from '../composables/useBedsRealtime';
import { useBedsStore } from '../stores/beds.store';
import type { Bed } from '../services/beds';
import BedGrid from './BedGrid.vue';
import BedLegend from './BedLegend.vue';
import NoticeBanner from './ui/NoticeBanner.vue';

const emit = defineEmits<{ select: [bed: Bed] }>();
const { beds, counts, loading, error, empty } = storeToRefs(useBedsStore());
useBedsRealtime();
</script>

<template>
  <NoticeBanner v-if="error" tone="error">{{ error }}</NoticeBanner>
  <p v-else-if="loading && beds.length === 0" role="status">Cargando camas...</p>
  <p v-else-if="empty" class="muted">Todavía no hay camas cargadas.</p>
  <div v-else class="overview">
    <BedGrid :beds="beds" @select="emit('select', $event)" />
    <BedLegend :counts="counts" />
  </div>
</template>

<style scoped>
.overview { display: grid; gap: 14px; }
</style>
