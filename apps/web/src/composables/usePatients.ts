import { ref } from 'vue';
import { createPatient, searchPatients, type CreatePatientInput, type Patient } from '../services/patients';
import { messageFrom } from '../shared/errors';

export function usePatients() {
  const patients = ref<Patient[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const saving = ref(false);
  const saveError = ref<string | null>(null);

  // Descarta respuestas viejas: una respuesta lenta no pisa a una más reciente.
  let latest = 0;

  async function load(query = ''): Promise<void> {
    const current = ++latest;
    loading.value = true;
    error.value = null;
    try {
      const found = await searchPatients(query);
      if (current === latest) patients.value = found;
    } catch (reason) {
      if (current === latest) error.value = messageFrom(reason, 'No se pudo cargar la lista de pacientes.');
    } finally {
      if (current === latest) loading.value = false;
    }
  }

  async function create(input: CreatePatientInput): Promise<Patient | null> {
    saving.value = true;
    saveError.value = null;
    try {
      return await createPatient(input);
    } catch (reason) {
      saveError.value = messageFrom(reason, 'No se pudo registrar al paciente.');
      return null;
    } finally {
      saving.value = false;
    }
  }

  return { patients, loading, error, saving, saveError, load, create };
}
