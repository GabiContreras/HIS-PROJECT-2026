import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { addTriage, listTriage, sortQueue, TRIAGE_LABELS, type TriageEntry, type TriageInput } from '../services/triage';
import { messageFrom } from '../shared/errors';
import { useNotificationsStore } from './notifications.store';

export const useTriageStore = defineStore('triage', () => {
  const notifications = useNotificationsStore();

  const entries = ref<TriageEntry[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const queue = computed(() => sortQueue(entries.value));
  const redCount = computed(() => entries.value.filter((e) => e.nivel === 'ROJO').length);

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      entries.value = await listTriage();
    } catch (reason) {
      error.value = messageFrom(reason, 'No se pudo cargar la cola de triaje.');
    } finally {
      loading.value = false;
    }
  }

  async function register(input: TriageInput): Promise<TriageEntry> {
    const saved = await addTriage(input);
    if (saved.nivel === 'ROJO') {
      notifications.push({
        level: 'critical',
        title: `${TRIAGE_LABELS.ROJO}`,
        detail: `${saved.paciente}: ${saved.motivo}. Pasa primero en la cola.`,
        roles: ['MEDICO'],
      });
    }
    await load();
    return saved;
  }

  return { entries, loading, error, queue, redCount, load, register };
});
