import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { useSessionStore } from '../features/iam/session.store';
import { addVitalSign, listVitalSigns, type VitalSign, type VitalSignInput } from '../services/vitalSigns';
import { messageFrom } from '../shared/errors';
import { useNotificationsStore } from './notifications.store';

export const useVitalsStore = defineStore('vitals', () => {
  const session = useSessionStore();
  const notifications = useNotificationsStore();

  const records = ref<VitalSign[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const latest = computed(() =>
    [...records.value].sort((a, b) => b.fechaHora.localeCompare(a.fechaHora)).slice(0, 3),
  );
  const critical = computed(() => records.value.filter((r) => r.critico));

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      records.value = await listVitalSigns();
    } catch (reason) {
      error.value = messageFrom(reason, 'No se pudieron cargar los registros.');
    } finally {
      loading.value = false;
    }
  }

  async function record(input: VitalSignInput): Promise<VitalSign> {
    const saved = await addVitalSign(input, session.fullName);
    if (saved.critico) {
      notifications.push({
        level: 'critical',
        title: 'Temperatura crítica',
        detail: `${saved.paciente}: ${saved.temperatura} °C. Requiere atención del médico de guardia.`,
        roles: ['MEDICO', 'ENFERMERO'],
      });
    }
    await load();
    return saved;
  }

  return { records, loading, error, latest, critical, load, record };
});
