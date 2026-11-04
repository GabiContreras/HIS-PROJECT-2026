import { computed, ref } from 'vue';
import { listBeds, type Bed } from '../services/beds';

export function useBeds() {
  const beds = ref<Bed[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const occupied = computed(() => beds.value.filter((b) => b.estado === 'OCUPADA').length);

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      beds.value = await listBeds();
    } catch {
      error.value = 'No se pudieron cargar las camas.';
    } finally {
      loading.value = false;
    }
  }
  return { beds, loading, error, occupied, load };
}