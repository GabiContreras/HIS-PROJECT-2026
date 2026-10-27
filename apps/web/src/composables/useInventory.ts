import { computed, ref } from 'vue';
import { listInventory, type InventoryItem } from '../services/inventory';

export const LOW_STOCK_THRESHOLD = 10;

export function useInventory() {
  const items = ref<InventoryItem[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const lowStock = computed(() =>
    items.value.filter((item) => item.cantidadDisponible < LOW_STOCK_THRESHOLD),
  );

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      items.value = await listInventory();
    } catch {
      error.value = 'No se pudo cargar el inventario.';
    } finally {
      loading.value = false;
    }
  }

  return { items, loading, error, lowStock, load };
}