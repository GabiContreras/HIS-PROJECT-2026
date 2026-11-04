import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { useBeds } from '../composables/useBeds';
import { useInventory } from '../composables/useInventory';
import { useAppointments } from '../features/admissions/useAppointments';
import { useSessionStore } from '../features/iam/session.store';
import { listTriage, type TriageEntry, type TriagePriority } from '../services/triage';
import { listVitalSigns, type VitalSign } from '../services/vitalSigns';

const PRIORITY_ORDER: Record<TriagePriority, number> = { ALTA: 0, MEDIA: 1, BAJA: 2 };

function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

export const useDashboardStore = defineStore('dashboard', () => {
  const session = useSessionStore();
  const bedsState = useBeds();
  const inventory = useInventory();
  const agenda = useAppointments();

  const triage = ref<TriageEntry[]>([]);
  const vitalSigns = ref<VitalSign[]>([]);
  const extrasLoading = ref(false);
  const extrasError = ref<string | null>(null);

  const canSeeAgenda = computed(() => session.role === 'MEDICO' || session.role === 'ADMINISTRATIVO');

  const totalBeds = computed(() => bedsState.beds.value.length);
  const occupiedBeds = computed(() => bedsState.beds.value.filter((b) => b.estado === 'OCUPADA').length);
  const availableBeds = computed(() => bedsState.beds.value.filter((b) => b.estado === 'DISPONIBLE').length);

  const todayAppointments = computed(() =>
    agenda.turnos.value
      .filter((t) => isToday(t.fechaHora))
      .sort((a, b) => a.fechaHora.localeCompare(b.fechaHora)),
  );
  const upcomingAppointments = computed(() =>
    todayAppointments.value.filter((t) => t.estado !== 'CANCELADO').slice(0, 6),
  );

  const sortedTriage = computed(() =>
    [...triage.value].sort(
      (a, b) => PRIORITY_ORDER[a.prioridad] - PRIORITY_ORDER[b.prioridad] || b.esperaMin - a.esperaMin,
    ),
  );
  const latestVitalSigns = computed(() =>
    [...vitalSigns.value].sort((a, b) => b.fechaHora.localeCompare(a.fechaHora)).slice(0, 3),
  );

  const loading = computed(
    () => bedsState.loading.value || inventory.loading.value || agenda.cargando.value || extrasLoading.value,
  );
  const error = computed(
    () => bedsState.error.value ?? inventory.error.value ?? agenda.error.value ?? extrasError.value,
  );

  async function loadExtras(): Promise<void> {
    extrasLoading.value = true;
    extrasError.value = null;
    try {
      [triage.value, vitalSigns.value] = await Promise.all([listTriage(), listVitalSigns()]);
    } catch {
      extrasError.value = 'No se pudo cargar el triaje ni los signos vitales.';
    } finally {
      extrasLoading.value = false;
    }
  }

  async function load(): Promise<void> {
    await Promise.allSettled([
      bedsState.load(),
      inventory.load(),
      loadExtras(),
      canSeeAgenda.value ? agenda.cargar() : Promise.resolve(),
    ]);
  }

  return {
    beds: bedsState.beds,
    items: inventory.items,
    lowStock: inventory.lowStock,
    triage: sortedTriage,
    latestVitalSigns,
    totalBeds,
    occupiedBeds,
    availableBeds,
    todayAppointments,
    upcomingAppointments,
    loading,
    error,
    load,
    canSeeAgenda,
  };
});