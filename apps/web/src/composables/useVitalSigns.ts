import { ref } from 'vue';
import { ApiError } from '../shared/http';
import {
  addVitalSign,
  listVitalSigns,
  listVitalTypes,
  type RegisterVitalSignInput,
  type VitalSign,
  type VitalType,
} from '../services/vitalSigns';

export function useVitalSigns() {
  const types = ref<VitalType[]>([]);
  const records = ref<VitalSign[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      [types.value, records.value] = await Promise.all([listVitalTypes(), listVitalSigns()]);
    } catch (e) {
      error.value = e instanceof ApiError ? e.message : 'No se pudieron cargar los signos vitales.';
    } finally {
      loading.value = false;
    }
  }

  /** Registra un signo vital; lanza ApiError (400 valor implausible, 404 paciente) para que el formulario lo muestre. */
  async function register(input: RegisterVitalSignInput): Promise<VitalSign> {
    const created = await addVitalSign(input);
    records.value = await listVitalSigns();
    return created;
  }

  return { types, records, loading, error, load, register };
}
