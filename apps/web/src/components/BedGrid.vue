<script setup lang="ts">
import { BED_STATUS_LABELS, type Bed } from '../services/beds';

defineProps<{ beds: Bed[] }>();
const emit = defineEmits<{ select: [bed: Bed] }>();

function tooltip(bed: Bed): string {
  if (bed.estado === 'OCUPADA' && bed.paciente) return `${bed.paciente} · Cama ${bed.numero}`;
  return `Cama ${bed.numero} · ${BED_STATUS_LABELS[bed.estado]}`;
}
</script>

<template>
  <div class="grid">
    <button
      v-for="bed in beds"
      :key="bed.id"
      type="button"
      class="bed"
      :class="`bed-${bed.estado.toLowerCase()}`"
      :title="tooltip(bed)"
      :aria-label="tooltip(bed)"
      @click="emit('select', bed)"
    >
      {{ bed.numero }}
    </button>
  </div>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: var(--space-2); }
.bed { height: 56px; border: 0; border-radius: 10px; color: #fff; font: inherit; font-weight: 600; cursor: pointer;
  transition: transform 0.12s, box-shadow 0.12s; }
.bed:hover { transform: translateY(-2px); box-shadow: 0 4px 10px rgba(0, 0, 0, 0.18); }
.bed:focus-visible { outline: 3px solid var(--color-accent); outline-offset: 2px; }
.bed-disponible { background: var(--cama-disponible); }
.bed-ocupada { background: var(--cama-ocupada); }
.bed-reservada { background: var(--cama-reservada); }
.bed-mantenimiento { background: var(--cama-mantenimiento); }
</style>