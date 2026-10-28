import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { decrementStock, listInventory, LOW_STOCK_THRESHOLD, type InventoryItem } from '../services/inventory';
import { messageFrom } from '../shared/errors';

export const useInventoryStore = defineStore('inventory', () => {
  const items = ref<InventoryItem[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const lowStock = computed(() => items.value.filter((i) => i.cantidadDisponible < LOW_STOCK_THRESHOLD));

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      items.value = await listInventory();
    } catch (reason) {
      error.value = messageFrom(reason, 'No se pudo cargar el inventario.');
    } finally {
      loading.value = false;
    }
  }

  /** Descuenta stock (lo usa enfermería al administrar una medicación). */
  async function consume(id: string, quantity = 1): Promise<void> {
    await decrementStock(id, quantity);
    await load();
  }

  return { items, loading, error, lowStock, load, consume };
});
