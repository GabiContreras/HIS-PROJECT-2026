<script setup lang="ts">
import { onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import BaseCard from '@/components/ui/BaseCard.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { useDashboardStore } from '@/stores/dashboard.store';

const store = useDashboardStore();
const { triage, loading } = storeToRefs(store);

// Mapeo para los niveles de triaje
const TONES: Record<string, 'danger' | 'warning' | 'success' | 'info'> = {
  ROJO: 'danger',
  NARANJA: 'danger',
  AMARILLO: 'warning',
  VERDE: 'success',
  AZUL: 'info',
  ALTA: 'danger',
  MEDIA: 'warning',
  BAJA: 'success',
};

const LABELS: Record<string, string> = {
  ROJO: 'Rojo',
  NARANJA: 'Naranja',
  AMARILLO: 'Amarillo',
  VERDE: 'Verde',
  AZUL: 'Azul',
  ALTA: 'Alta',
  MEDIA: 'Media',
  BAJA: 'Baja',
};

onMounted(() => {
  if ('fetchTriage' in store && typeof store.fetchTriage === 'function') {
    store.fetchTriage();
  }
});
</script>

<template>
  <BaseCard>
    <template #title>Cola de triaje</template>
    
    <p v-if="loading && triage.length === 0" role="status">Cargando cola...</p>
    <p v-else-if="triage.length === 0" class="muted">No hay pacientes en espera.</p>
    
    <ul v-else>
      <li v-for="(item, index) in triage" :key="(item as any).id || index">
        <div class="who">
          <strong>
            {{ (item as any).paciente || (item as any).pacienteId || 'Paciente' }}
          </strong>
          <span class="muted">
            {{ (item as any).motivo || (item as any).motivoConsulta }} 
            <template v-if="(item as any).esperaMin"> · espera {{ (item as any).esperaMin }} min</template>
          </span>
        </div>
        <StatusChip 
          :label="LABELS[(item as any).nivel || (item as any).prioridad] || (item as any).nivel || (item as any).prioridad" 
          :tone="TONES[(item as any).nivel || (item as any).prioridad] || 'info'" 
        />
      </li>
    </ul>
  </BaseCard>
</template>

<style scoped>
h3 { margin: 0; }
ul { list-style: none; padding: 0; margin: 0; }
li { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  gap: var(--space-2);
  padding: var(--space-2) 0; 
  border-bottom: 1px solid var(--color-border); 
}
.who { display: grid; min-width: 0; }
.muted { color: var(--color-muted); font-size: 0.85rem; }
</style>