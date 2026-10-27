<script setup lang="ts">
import { storeToRefs } from 'pinia';
import BaseCard from '@/components/ui/BaseCard.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { LOW_STOCK_THRESHOLD } from '@/composables/useInventory';
import { useDashboardStore } from '@/stores/dashboard.store';

const { items, loading } = storeToRefs(useDashboardStore());
</script>

<template>
  <BaseCard>
    <template #header><h3>Stock de insumos</h3></template>
    <p v-if="loading && items.length === 0" role="status">Cargando insumos...</p>
    <p v-else-if="items.length === 0" class="muted">No hay insumos cargados.</p>
    <ul v-else>
      <li v-for="item in items.slice(0, 4)" :key="item.id">
        <span>{{ item.nombre }}</span>
        <span class="qty">
          {{ item.cantidadDisponible }} {{ item.unidadMedida }}
          <StatusChip v-if="item.cantidadDisponible < LOW_STOCK_THRESHOLD" label="Bajo" tone="danger" />
        </span>
      </li>
    </ul>
  </BaseCard>
</template>

<style scoped>
h3 { margin: 0; }
ul { list-style: none; padding: 0; margin: 0; }
li { display: flex; justify-content: space-between; align-items: center; gap: var(--space-2);
  padding: var(--space-2) 0; border-bottom: 1px solid var(--color-border); }
.qty { display: flex; align-items: center; gap: var(--space-2); font-weight: 600; }
.muted { color: var(--color-muted); }
</style>