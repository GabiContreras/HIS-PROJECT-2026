<script setup lang="ts">
import { storeToRefs } from 'pinia';
import BaseCard from '@/components/ui/BaseCard.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { useDashboardStore } from '@/stores/dashboard.store';
import type { TriagePriority } from '@/services/triage';

const { triage, loading } = storeToRefs(useDashboardStore());

const TONES: Record<TriagePriority, 'danger' | 'warning' | 'success'> = {
  ALTA: 'danger',
  MEDIA: 'warning',
  BAJA: 'success',
};
const LABELS: Record<TriagePriority, string> = { ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja' };
</script>

<template>
  <BaseCard>
    <template #header><h3>Cola de triaje</h3></template>
    <p v-if="loading && triage.length === 0" role="status">Cargando cola...</p>
    <p v-else-if="triage.length === 0" class="muted">No hay pacientes en espera.</p>
    <ul v-else>
      <li v-for="t in triage" :key="t.id">
        <div class="who">
          <strong>{{ t.paciente }}</strong>
          <span class="muted">{{ t.motivo }} · espera {{ t.esperaMin }} min</span>
        </div>
        <StatusChip :label="LABELS[t.prioridad]" :tone="TONES[t.prioridad]" />
      </li>
    </ul>
  </BaseCard>
</template>

<style scoped>
h3 { margin: 0; }
ul { list-style: none; padding: 0; margin: 0; }
li { display: flex; justify-content: space-between; align-items: center; gap: var(--space-2);
  padding: var(--space-2) 0; border-bottom: 1px solid var(--color-border); }
.who { display: grid; min-width: 0; }
.muted { color: var(--color-muted); font-size: 0.85rem; }
</style>