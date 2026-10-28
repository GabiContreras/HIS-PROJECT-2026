<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import DataTable from '@/components/ui/DataTable.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { LOW_STOCK_THRESHOLD, useInventory } from '@/composables/useInventory';

const { items, lowStock, loading, error, load } = useInventory();
const columns = [
  { key: 'nombre', label: 'Insumo' },
  { key: 'unidadMedida', label: 'Unidad' },
  { key: 'cantidadDisponible', label: 'Disponible' },
  { key: 'estado', label: 'Estado' },
];
const query = ref('');
const onlyLow = ref(false);

const visible = computed(() => {
  const q = query.value.trim().toLowerCase();
  return items.value.filter(
    (i) =>
      (!q || i.nombre.toLowerCase().includes(q)) &&
      (!onlyLow.value || i.cantidadDisponible < LOW_STOCK_THRESHOLD),
  );
});

onMounted(load);
</script>

<template>
  <section>
    <header class="head">
      <div>
        <h1>Insumos</h1>
        <p>{{ items.length }} insumos · {{ lowStock.length }} con stock bajo</p>
      </div>
      <div class="filters">
        <input v-model="query" type="search" placeholder="Buscar insumo..." />
        <label><input v-model="onlyLow" type="checkbox" /> Solo stock bajo</label>
      </div>
    </header>

    <p v-if="error" class="error" role="alert">
      {{ error }} <button type="button" :disabled="loading" @click="load">Reintentar</button>
    </p>
    <p v-else-if="loading && items.length === 0" role="status">Cargando insumos...</p>
    <p v-else-if="items.length === 0">No hay insumos cargados.</p>
    <p v-else-if="visible.length === 0">No hay insumos que coincidan.</p>
    <DataTable v-else :data="visible" :columns="columns">
      <template #cell-cantidadDisponible="{ row }"><strong>{{ row.cantidadDisponible }}</strong></template>
      <template #cell-estado="{ row }">
        <StatusChip v-if="row.cantidadDisponible < LOW_STOCK_THRESHOLD" label="Stock bajo" tone="danger" />
        <StatusChip v-else label="Normal" tone="success" />
      </template>
    </DataTable>
  </section>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: end; flex-wrap: wrap; gap: var(--space-3); margin-bottom: var(--space-3); }
.head h1, .head p { margin: 0; }
.head p { color: var(--color-muted); margin-top: var(--space-1); }
.filters { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-3); }
.filters input[type='search'] { font: inherit; padding: 8px 12px; border: 1px solid var(--color-border); border-radius: 8px; }
:deep(.data-table) { width: 100%; border-collapse: collapse; background: var(--color-surface); border-radius: var(--radius); }
:deep(.data-table th), :deep(.data-table td) { padding: var(--space-2) var(--space-3); text-align: left; border-bottom: 1px solid var(--color-border); }
:deep(.data-table th) { color: var(--color-muted); font-size: 0.8rem; }
:deep(.data-table tbody tr:hover) { background: #f1f5f9; }
.error { color: var(--color-danger); }
</style>