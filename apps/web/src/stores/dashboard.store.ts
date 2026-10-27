import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { listBeds, type Bed } from '@/services/beds';

export const useDashboardStore = defineStore('dashboard', () => {
  // Estado
  const camas = ref<Bed[]>([]);
  const cargando = ref(false);
  const error = ref<string | null>(null);

  // Acciones (equivalente a cargar)
  const cargarDatos = async () => {
    cargando.value = true;
    error.value = null;
    try {
      camas.value = await listBeds();
    } catch (err: any) {
      error.value = err.message || 'Error al obtener datos del store';
    } finally {
      cargando.value = false;
    }
  };

  // Getters (computed en Pinia con Composition API)
  const totalCamas = computed(() => camas.value.length);
  const camasOcupadas = computed(() => camas.value.filter(c => c.estado === 'OCUPADA').length);
  const camasDisponibles = computed(() => camas.value.filter(c => c.estado === 'DISPONIBLE').length);

  return {
    camas,
    cargando,
    error,
    cargarDatos,
    totalCamas,
    camasOcupadas,
    camasDisponibles
  };
});