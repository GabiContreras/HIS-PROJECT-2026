<script setup lang="ts">
import { storeToRefs } from 'pinia';
import BaseCard from '@/components/ui/BaseCard.vue';
import { vitalTypeLabel } from '@/services/vitalSigns';
import { useDashboardStore } from '@/stores/dashboard.store';

const { latestVitalSigns, loading, canSeeVitals } = storeToRefs(useDashboardStore());

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
</script>

<template>
  <BaseCard>
    <template #header><h3>Últimos signos vitales registrados</h3></template>
    <p v-if="!canSeeVitals" class="muted">Tu rol no tiene acceso a los signos vitales.</p>
    <p v-else-if="loading && latestVitalSigns.length === 0" role="status">Cargando registros...</p>
    <p v-else-if="latestVitalSigns.length === 0" class="muted">Todavía no hay registros.</p>
    <ul v-else>
      <li v-for="v in latestVitalSigns" :key="v.id">
        <div class="who">
          <strong>{{ v.paciente }}</strong>
          <span class="muted">{{ vitalTypeLabel(v.tipo) }}</span>
        </div>
        <div class="val">
          <strong :class="{ 'out-of-range': v.fueraDeRango }">{{ v.valor }} {{ v.unidad }}</strong>
          <span class="muted">{{ time(v.fechaHora) }}</span>
        </div>
      </li>
    </ul>
  </BaseCard>
</template>

<style scoped>
h3 { margin: 0; }
ul { list-style: none; padding: 0; margin: 0; }
li { display: flex; justify-content: space-between; gap: var(--space-2);
  padding: var(--space-2) 0; border-bottom: 1px solid var(--color-border); }
.who, .val { display: grid; }
.val { text-align: right; }
.out-of-range { color: var(--color-danger); }
.muted { color: var(--color-muted); font-size: 0.85rem; }
</style>