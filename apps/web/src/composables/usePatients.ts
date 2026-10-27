import { ref } from 'vue';
import { listPatients, type Patient } from '../services/patients';

export function usePatients() {
  const patients = ref<Patient[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      patients.value = await listPatients();
    } catch {
      error.value = 'No se pudo cargar la lista de pacientes.';
    } finally {
      loading.value = false;
    }
  }

  return { patients, loading, error, load };
}