import { computed, ref } from 'vue';
import { ApiError } from '../shared/http';
import { administerDose, listIndications, type Indication } from '../services/medications';

export function useMedications() {
  const indications = ref<Indication[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const pendingCount = computed(() =>
    indications.value.reduce((n, i) => n + i.dosisDelDia.filter((d) => d.estado === 'PENDIENTE').length, 0),
  );
  const totalDoses = computed(() => indications.value.reduce((n, i) => n + i.dosisDelDia.length, 0));

  async function load(pacienteId?: string): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      indications.value = await listIndications(pacienteId);
    } catch (e) {
      error.value = e instanceof ApiError ? e.message : 'No se pudieron cargar las indicaciones.';
    } finally {
      loading.value = false;
    }
  }

  /** Registra la administración; lanza ApiError (409, 403, 404...) para que la pantalla muestre el motivo. */
  async function administer(indicationId: string, observaciones?: string): Promise<void> {
    await administerDose(indicationId, observaciones);
  }

  return { indications, pendingCount, totalDoses, loading, error, load, administer };
}
