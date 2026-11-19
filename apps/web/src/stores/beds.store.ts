import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  assignBed,
  blockBed,
  confirmCleaning,
  dischargeBed,
  getBed,
  listBeds,
  streamBedChanges,
  unblockBed,
  type AssignBedInput,
  type Bed,
  type BedChange,
  type BedStatus,
} from '../services/beds';
import { messageFrom } from '../shared/errors';

export const RECONNECT_MIN_MS = 1_000;
export const RECONNECT_MAX_MS = 30_000;

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done(): void {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
    signal.addEventListener('abort', done);
  });
}

export const useBedsStore = defineStore('beds', () => {
  const beds = ref<Bed[]>([]);
  const loading = ref(false);
  const loaded = ref(false);
  const error = ref<string | null>(null);

  const total = computed(() => beds.value.length);
  const empty = computed(() => loaded.value && !error.value && beds.value.length === 0);
  const admittedPatientIds = computed(() =>
    beds.value.flatMap((b) => (b.estado === 'OCUPADA' && b.paciente ? [b.paciente.id] : [])),
  );
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
      loaded.value = true;
    } catch (reason) {
      error.value = messageFrom(reason, 'No se pudieron cargar las camas.');
    } finally {
      loading.value = false;
    }
  }

  async function refresh(): Promise<void> {
    try {
      beds.value = await listBeds();
      loaded.value = true;
    } catch {
      return;
    }
  }

  async function mutate(operation: () => Promise<unknown>): Promise<void> {
    try {
      await operation();
    } finally {
      await load();
    }
  }

  function upsert(bed: Bed): void {
    if (!bed.activa) {
      beds.value = beds.value.filter((b) => b.id !== bed.id);
      return;
    }
    const index = beds.value.findIndex((b) => b.id === bed.id);
    beds.value = index === -1 ? [...beds.value, bed] : beds.value.map((b) => (b.id === bed.id ? bed : b));
  }

  const lastEventAt = new Map<string, number>();
  const eventSeq = new Map<string, number>();

  async function applyChange(change: BedChange): Promise<void> {
    const at = Date.parse(change.at);
    const last = lastEventAt.get(change.camaId);
    if (Number.isFinite(at)) {
      if (last !== undefined && at < last) return;
      lastEventAt.set(change.camaId, at);
    }
    const seq = (eventSeq.get(change.camaId) ?? 0) + 1;
    eventSeq.set(change.camaId, seq);

    const known = beds.value.some((b) => b.id === change.camaId);
    if (known) {
      beds.value = beds.value.map((b) =>
        b.id === change.camaId
          ? {
              ...b,
              estado: change.estado,
              paciente: change.estado === 'OCUPADA' ? b.paciente : null,
              motivoBloqueo: change.estado === 'MANTENIMIENTO' ? b.motivoBloqueo : null,
            }
          : b,
      );
    }
    if (known && change.estado !== 'OCUPADA' && change.estado !== 'MANTENIMIENTO') return;

    const fresh = await getBed(change.camaId).catch(() => undefined);
    if (fresh && eventSeq.get(change.camaId) === seq) upsert(fresh);
  }

  async function runStream(signal: AbortSignal): Promise<void> {
    let delay = RECONNECT_MIN_MS;
    let reconnecting = false;
    while (!signal.aborted) {
      try {
        const changes = streamBedChanges(signal, () => {
          delay = RECONNECT_MIN_MS;
          if (reconnecting) void refresh();
        });
        for await (const change of changes) await applyChange(change);
      } catch {
        if (signal.aborted) return;
      }
      if (signal.aborted) return;
      reconnecting = true;
      await pause(delay, signal);
      delay = Math.min(delay * 2, RECONNECT_MAX_MS);
    }
  }

  let subscribers = 0;
  let controller: AbortController | null = null;

  function connect(): void {
    subscribers += 1;
    if (subscribers > 1) return;
    controller = new AbortController();
    void runStream(controller.signal);
  }

  function disconnect(): void {
    if (subscribers === 0) return;
    subscribers -= 1;
    if (subscribers > 0) return;
    controller?.abort();
    controller = null;
  }

  return {
    beds,
    loading,
    error,
    empty,
    total,
    occupied,
    admittedPatientIds,
    counts,
    load,
    connect,
    disconnect,
    applyChange,
    assign: (id: string, input: AssignBedInput) => mutate(() => assignBed(id, input)),
    discharge: (id: string) => mutate(() => dischargeBed(id)),
    clean: (id: string) => mutate(() => confirmCleaning(id)),
    block: (id: string, motivo: string) => mutate(() => blockBed(id, motivo)),
    unblock: (id: string) => mutate(() => unblockBed(id)),
  };
});
