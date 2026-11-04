<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import BaseCard from '../../components/ui/BaseCard.vue';
import NoticeBanner from '../../components/ui/NoticeBanner.vue';
import PageHeader from '../../components/ui/PageHeader.vue';
import StatusChip from '../../components/ui/StatusChip.vue';
import { LOW_STOCK_THRESHOLD } from '../../services/inventory';
import { useInventoryStore } from '../../stores/inventory.store';

const store = useInventoryStore();
const { items, lowStock, loading, error } = storeToRefs(store);

const query = ref('');
const onlyLow = ref(false);

const visible = computed(() => {
  const q = query.value.trim().toLowerCase();
  return items.value.filter(
    (i) => (!q || i.nombre.toLowerCase().includes(q)) && (!onlyLow.value || i.cantidadDisponible < LOW_STOCK_THRESHOLD),
  );
});

onMounted(store.load);
</script>

<template>
  <div class="page">
    <PageHeader title="Insumos" :subtitle="`${items.length} insumos · ${lowStock.length} con stock bajo. El stock baja solo cuando enfermería administra medicación.`">
      <input v-model="query" class="search" type="search" placeholder="Buscar insumo..." aria-label="Buscar insumo" />
      <label class="check"><input v-model="onlyLow" type="checkbox" /> Solo stock bajo</label>
    </PageHeader>

    <BaseCard>
      <template #header><h3>Inventario del piso</h3></template>
      <NoticeBanner v-if="error" tone="error">
        {{ error }} <button type="button" class="btn-sm" :disabled="loading" @click="store.load">Reintentar</button>
      </NoticeBanner>
      <p v-else-if="loading && items.length === 0" role="status">Cargando insumos...</p>
      <p v-else-if="visible.length === 0" class="muted">No hay insumos que coincidan.</p>
      <div v-else class="scroll-x">
        <table>
          <thead><tr><th>Insumo</th><th>Unidad</th><th>Disponible</th><th>Estado</th></tr></thead>
          <tbody>
            <tr v-for="item in visible" :key="item.id">
              <td>{{ item.nombre }}</td>
              <td>{{ item.unidadMedida }}</td>
              <td><strong>{{ item.cantidadDisponible }}</strong></td>
              <td>
                <StatusChip v-if="item.cantidadDisponible < LOW_STOCK_THRESHOLD" label="Stock bajo" tone="danger" />
                <StatusChip v-else label="Normal" tone="success" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </BaseCard>
  </div>
</template>

<style scoped>
.search { width: 240px; }
.check { display: flex; align-items: center; gap: 8px; font-weight: 500; }
.check input { width: auto; }
</style>
