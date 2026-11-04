import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  assignBed,
  confirmCleaning,
  dischargeBed,
  listBeds,
  toggleBlocked,
  type Bed,
  type BedPatient,
  type BedStatus,
} from '../services/beds';
import { messageFrom } from '../shared/errors';

export const useBedsStore = defineStore('beds', () => {
  const beds = ref<Bed[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const total = computed(() => beds.value.length);
  const occupied = computed(() => beds.value.filter((b) => b.estado === 'OCUPADA').length);
  const counts = computed(() => {
    const result: Record<BedStatus, number> = { DISPONIBLE: 0, OCUPADA: 0, EN_LIMPIEZA: 0, MANTENIMIENTO: 0 };
    for (const bed of beds.value) result[bed.estado] += 1;
    return result;
  });

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      beds.value = await listBeds();
    } catch (reason) {
      error.value = messageFrom(reason, 'No se pudieron cargar las camas.');
    } finally {
      loading.value = false;
    }
  }

  /** Ejecuta un cambio y refresca el mapa aunque falle (por ejemplo, por un conflicto de concurrencia). */
  async function mutate(operation: () => Promise<unknown>): Promise<void> {
    try {
      await operation();
    } finally {
      await load();
    }
  }

  return {
    beds,
    loading,
    error,
    total,
    occupied,
    counts,
    load,
    assign: (id: string, patient: BedPatient, version: number) => mutate(() => assignBed(id, patient, version)),
    discharge: (id: string) => mutate(() => dischargeBed(id)),
    clean: (id: string) => mutate(() => confirmCleaning(id)),
    toggleBlocked: (id: string) => mutate(() => toggleBlocked(id)),
  };
});
