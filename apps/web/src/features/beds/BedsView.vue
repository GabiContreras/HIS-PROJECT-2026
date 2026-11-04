<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import BedGrid from '../../components/BedGrid.vue';
import BedLegend from '../../components/BedLegend.vue';
import BaseCard from '../../components/ui/BaseCard.vue';
import NoticeBanner from '../../components/ui/NoticeBanner.vue';
import PageHeader from '../../components/ui/PageHeader.vue';
import { BED_STATUS_LABELS, type Bed, type BedStatus } from '../../services/beds';
import { useBedsStore } from '../../stores/beds.store';

const router = useRouter();
const store = useBedsStore();
const { beds, counts, loading, error } = storeToRefs(store);

const STATUSES = Object.keys(BED_STATUS_LABELS) as BedStatus[];
const filter = ref<BedStatus | ''>('');
const visible = computed(() => (filter.value ? beds.value.filter((b) => b.estado === filter.value) : beds.value));

function openBed(bed: Bed): void {
  void router.push({ name: 'bed-detail', params: { id: bed.id } });
}

onMounted(store.load);
</script>

<template>
  <div class="page">
    <PageHeader title="Camas" subtitle="Mapa de camas en tiempo real. Tocá una cama para ver su detalle y operarla.">
      <select v-model="filter" aria-label="Filtrar por estado" class="filter">
        <option value="">Todos los estados</option>
        <option v-for="s in STATUSES" :key="s" :value="s">{{ BED_STATUS_LABELS[s] }}</option>
      </select>
    </PageHeader>

    <BaseCard>
      <template #header><h3>Mapa de camas</h3></template>
      <template #action><BedLegend :counts="counts" /></template>
      <NoticeBanner v-if="error" tone="error">
        {{ error }} <button type="button" class="btn-sm" :disabled="loading" @click="store.load">Reintentar</button>
      </NoticeBanner>
      <p v-else-if="loading && beds.length === 0" role="status">Cargando camas...</p>
      <p v-else-if="visible.length === 0" class="muted">No hay camas con ese estado.</p>
      <BedGrid v-else :beds="visible" @select="openBed" />
    </BaseCard>
  </div>
</template>

<style scoped>
.filter { width: auto; }
</style>
