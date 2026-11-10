import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { administerMedication, listMedications, type Medication } from '../services/medications';
import { messageFrom } from '../shared/errors';
import { useInventoryStore } from './inventory.store';

export const useMedicationsStore = defineStore('medications', () => {
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

  /** Registra la administración; el backend toma al enfermero de la sesión y descuenta el insumo. */
  async function administer(id: string): Promise<void> {
    await administerMedication(id);
    await Promise.all([load(), inventory.load()]);
  }

  return { medications, loading, error, pending, load, administer };
});
