import { computed, ref } from 'vue';
import { listCharges, type Charge } from '../services/charges';
import { messageFrom } from '../shared/errors';

export function useCharges() {
  const charges = ref<Charge[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const total = computed(() => charges.value.reduce((sum, c) => sum + c.importePesos, 0));
  const urgentCount = computed(() => charges.value.filter((c) => c.tipoAtencion === 'URGENCIA').length);

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      charges.value = await listCharges();
    } catch (reason) {
      error.value = messageFrom(reason, 'No se pudieron cargar los cargos.');
    } finally {
      loading.value = false;
    }
  }

  return { charges, loading, error, total, urgentCount, load };
}
