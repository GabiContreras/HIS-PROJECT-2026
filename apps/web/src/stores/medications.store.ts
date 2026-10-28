import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { useSessionStore } from '../features/iam/session.store';
import { administerMedication, listMedications, type Medication } from '../services/medications';
import { messageFrom } from '../shared/errors';
import { useInventoryStore } from './inventory.store';

export const useMedicationsStore = defineStore('medications', () => {
  const session = useSessionStore();
  const inventory = useInventoryStore();

  const medications = ref<Medication[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const pending = computed(() => medications.value.filter((m) => m.estado === 'PENDIENTE'));

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      medications.value = await listMedications();
    } catch (reason) {
      error.value = messageFrom(reason, 'No se pudieron cargar las medicaciones.');
    } finally {
      loading.value = false;
    }
  }

  /** Registra la administración con el usuario que la aplicó y descuenta el insumo del inventario. */
  async function administer(id: string): Promise<void> {
    const done = await administerMedication(id, session.fullName);
    if (done.insumoId) await inventory.consume(done.insumoId, 1);
    await load();
  }

  return { medications, loading, error, pending, load, administer };
});
