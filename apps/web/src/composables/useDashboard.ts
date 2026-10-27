import { ref,computed } from 'vue';
import { useBeds } from './../composables/useBeds';
import { useInventory } from './useInventory';

export function useDashboard() {
  // Renombramos el error de beds para que no choque con el local
  const { beds, loading: loadingBeds, error: errorBeds, occupied, load } = useBeds();
  const { insumos, cargar: cargarInsumos } = useInventory();

  const cargando = ref(false);
  const error = ref<string | null>(null);

  const cargar = async () => {
    cargando.value = true;
    error.value = null;
    try {
      await Promise.all([load(), cargarInsumos()]);
    } catch (err) {
      error.value = 'Error al sincronizar el dashboard';
    } finally {
      cargando.value = false;
    }
  };

  // Definimos total (por ejemplo, el total de camas)
  const total = computed(() => beds.value.length);

  return { 
    beds, 
    insumos, 
    cargando, 
    error, 
    errorBeds,
    cargar, 
    occupied, 
    total 
  };
}