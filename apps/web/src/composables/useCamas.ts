import { ref, computed } from 'vue';
import { listarCamas, type Cama } from '@/services/camas';

export function useCamas() {
  const camas = ref<Cama[]>([]);
  const cargando = ref(false);
  const error = ref<string | null>(null);

  const cargar = async () => {
    cargando.value = true;
    error.value = null;
    try {
      camas.value = await listarCamas();
    } catch (err: any) {
      error.value = err.message || 'Error al cargar las camas';
    } finally {
      cargando.value = false;
    }
  };

  // Propiedades computadas solicitadas
  const camasOcupadas = computed(() => camas.value.filter(c => c.estado === 'Ocupada'));
  const totalCamas = computed(() => camas.value.length);

  return {
    camas,
    cargando,
    error,
    cargar,
    camasOcupadas,
    totalCamas
  };
}