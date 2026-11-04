import { computed, ref } from 'vue';
import { listMedications, markAdministered, type Medication } from '../services/medications';

export function useMedications() {
  const medications = ref<Medication[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const pending = computed(() => medications.value.filter((m) => m.estado === 'PENDIENTE'));

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      medications.value = await listMedications();
    } catch {
      error.value = 'No se pudieron cargar las medicaciones.';
    } finally {
      loading.value = false;
    }
  }

  async function administer(id: string): Promise<void> {
    try {
      await markAdministered(id);
      await load();
    } catch {
      error.value = 'No se pudo registrar la administración.';
    }
  }

  return { medications, pending, loading, error, load, administer };
}