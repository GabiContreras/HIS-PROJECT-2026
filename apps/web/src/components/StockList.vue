<script setup lang="ts">
import { LOW_STOCK_THRESHOLD, type InventoryItem } from '../services/inventory';
import StatusChip from './ui/StatusChip.vue';

defineProps<{ items: InventoryItem[]; limit?: number }>();
</script>

<template>
  <p v-if="items.length === 0" class="muted">No hay insumos cargados.</p>
  <ul v-else class="list">
    <li v-for="item in items.slice(0, limit ?? items.length)" :key="item.id">
      <span>{{ item.nombre }}</span>
      <span class="qty">
        <strong>{{ item.cantidadDisponible }}</strong> {{ item.unidadMedida }}
        <StatusChip v-if="item.cantidadDisponible < LOW_STOCK_THRESHOLD" label="Bajo" tone="danger" />
      </span>
    </li>
  </ul>
</template>

<style scoped>
.qty { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; }
</style>
