<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import BedGrid from '../../components/BedGrid.vue';
import { useBeds } from '../../composables/useBeds';
import { BED_STATUS_LABELS, type Bed, type BedStatus } from '../../services/beds';

const router = useRouter();
const { beds, loading, error, load } = useBeds();

const STATUSES = Object.keys(BED_STATUS_LABELS) as BedStatus[];
const filter = ref<BedStatus | ''>('');

const visible = computed(() =>
  filter.value ? beds.value.filter((b) => b.estado === filter.value) : beds.value,
);
const counts = computed(() =>
  STATUSES.map((s) => ({ status: s, total: beds.value.filter((b) => b.estado === s).length })),
);

function openBed(bed: Bed): void {
  void router.push({ name: 'bed-detail', params: { id: bed.id } });
}

onMounted(load);
</script>

<template>
  <section>
    <header class="head">
      <div>
        <h1>Camas</h1>
        <p>Estado de ocupación por cama. Hacé clic en una para ver el detalle.</p>
      </div>
      <label class="filter">
        Filtrar por estado
        <select v-model="filter">
          <option value="">Todos</option>
          <option v-for="s in STATUSES" :key="s" :value="s">{{ BED_STATUS_LABELS[s] }}</option>
        </select>
      </label>
    </header>

    <ul class="legend">
      <li v-for="c in counts" :key="c.status">
        <span class="dot" :class="`bed-${c.status.toLowerCase()}`"></span>
        {{ BED_STATUS_LABELS[c.status] }} ({{ c.total }})
      </li>
    </ul>

    <p v-if="error" class="error" role="alert">
      {{ error }} <button type="button" :disabled="loading" @click="load">Reintentar</button>
    </p>
    <p v-else-if="loading" role="status">Cargando camas...</p>
    <p v-else-if="visible.length === 0">No hay camas con ese estado.</p>
    <BedGrid v-else :beds="visible" @select="openBed" />
  </section>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: end; flex-wrap: wrap; gap: var(--space-3); margin-bottom: var(--space-3); }
.head h1, .head p { margin: 0; }
.head p { color: var(--color-muted); margin-top: var(--space-1); }
.filter { display: grid; gap: var(--space-1); font-size: 0.9rem; }
.filter select { font: inherit; padding: 8px; border-radius: 8px; border: 1px solid var(--color-border); }
.legend { display: flex; flex-wrap: wrap; gap: var(--space-3); list-style: none; padding: 0; margin: 0 0 var(--space-3); }
.dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 6px; }
.bed-disponible { background: var(--cama-disponible); }
.bed-ocupada { background: var(--cama-ocupada); }
.bed-reservada { background: var(--cama-reservada); }
.bed-mantenimiento { background: var(--cama-mantenimiento); }
.error { color: var(--color-danger); }
</style>