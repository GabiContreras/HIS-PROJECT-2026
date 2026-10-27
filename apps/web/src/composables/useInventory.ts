import { ref, computed } from 'vue';
import { listInventory, type InventoryItem } from '@/services/inventory';

export function useInventory() {
  const insumos = ref<InventoryItem[]>([]);
  const cargando = ref(false);
  const error = ref<string | null>(null);

  const cargar = async () => {
    cargando.value = true;
    error.value = null;
    try {
      insumos.value = await listInventory();
    } catch (err: any) {
      error.value = err.message || 'Error al cargar los insumos';
    } finally {
      cargando.value = false;
    }
  };

  const insumosBajos = computed(() => insumos.value.filter(i => i.cantidadDisponible < 50));

  return { insumos, cargando, error, cargar, insumosBajos };
}