import { ref } from 'vue';
import { useCamas } from './useCamas';
import { useInsumos } from './useInsumos';

export function useDashboard() {
  const { camas, cargando: cargandoCamas, error: errorCamas, cargar: cargarCamas, camasOcupadas, totalCamas } = useCamas();
  const { insumos, cargando: cargandoInsumos, error: errorInsumos, cargar: cargarInsumos } = useInsumos();

  const cargando = ref(false);
  const error = ref<string | null>(null);

  const cargar = async () => {
    cargando.value = true;
    try {
      await Promise.all([cargarCamas(), cargarInsumos()]);
    } catch (err: any) {
      error.value = 'Error al sincronizar el dashboard';
    } finally {
      cargando.value = false;
    }
  };

  return {
    camas,
    insumos,
    cargando,
    error,
    cargar,
    camasOcupadas,
    totalCamas
  };
}