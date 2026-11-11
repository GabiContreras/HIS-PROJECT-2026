import { ref } from 'vue';
import { ApiError } from '../shared/http';
import { listProtocols, markProtocolTask, type Protocol } from '../services/protocols';

export function useProtocols() {
  const protocols = ref<Protocol[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const taskError = ref<string | null>(null);
  const pendingTasks = ref<ReadonlySet<string>>(new Set());

  let request = 0;

  async function load(pacienteId: string): Promise<void> {
    const current = ++request;
    loading.value = true;
    error.value = null;
    try {
      const found = await listProtocols(pacienteId);
      if (current === request) protocols.value = found;
    } catch (e) {
      if (current === request) {
        protocols.value = [];
        error.value = e instanceof ApiError ? e.message : 'No se pudo cargar el protocolo del paciente.';
      }
    } finally {
      if (current === request) loading.value = false;
    }
  }

  function clear(): void {
    request++;
    protocols.value = [];
    error.value = null;
    taskError.value = null;
    loading.value = false;
  }

  function setPending(taskId: string, pending: boolean): void {
    const next = new Set(pendingTasks.value);
    if (pending) next.add(taskId);
    else next.delete(taskId);
    pendingTasks.value = next;
  }

  async function toggleTask(protocolId: string, taskId: string, hecha: boolean): Promise<void> {
    const task = protocols.value.find((p) => p.id === protocolId)?.tareas.find((t) => t.id === taskId);
    if (!task || pendingTasks.value.has(taskId)) return;
    const previous = { hecha: task.hecha, hechaEn: task.hechaEn, hechaPor: task.hechaPor };
    taskError.value = null;
    task.hecha = hecha;
    task.hechaEn = hecha ? new Date().toISOString() : null;
    task.hechaPor = null;
    setPending(taskId, true);
    try {
      const updated = await markProtocolTask(protocolId, taskId, hecha);
      protocols.value = protocols.value.map((p) => (p.id === updated.id ? updated : p));
    } catch (e) {
      Object.assign(task, previous);
      taskError.value = `No se pudo guardar el cambio: ${e instanceof ApiError ? e.message : 'revisá tu conexión.'} La casilla volvió a su estado anterior.`;
    } finally {
      setPending(taskId, false);
    }
  }

  return { protocols, loading, error, taskError, pendingTasks, load, clear, toggleTask };
}
