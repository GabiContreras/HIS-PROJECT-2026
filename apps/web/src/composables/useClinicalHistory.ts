import { ref } from 'vue';
import { ApiError } from '../shared/http';
import {
  addClinicalRecord,
  getClinicalHistory,
  type ClinicalHistory,
  type ClinicalSection,
} from '../services/clinicalHistory';

export function useClinicalHistory() {
  const history = ref<ClinicalHistory | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function load(pacienteId: string): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      history.value = await getClinicalHistory(pacienteId);
    } catch (e) {
      history.value = null;
      error.value = e instanceof ApiError ? e.message : 'No se pudo cargar la historia clínica.';
    } finally {
      loading.value = false;
    }
  }

  /** Agrega un registro y recarga la historia; lanza ApiError (400, 403, 404) para que el formulario lo muestre. */
  async function add(pacienteId: string, section: ClinicalSection, titulo: string, detalle: string): Promise<void> {
    await addClinicalRecord(pacienteId, section, titulo, detalle);
    history.value = await getClinicalHistory(pacienteId);
  }

  function clear(): void {
    history.value = null;
    error.value = null;
  }

  return { history, loading, error, load, add, clear };
}
