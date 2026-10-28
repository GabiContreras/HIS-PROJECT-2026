import { ref } from 'vue';
import { ApiError } from '../../shared/http';
import {
  crearTurno,
  listarAgenda,
  reservarTurno,
  transicionarTurno,
  type CrearTurnoInput,
  type EstadoTurno,
  type TurnoAgenda,
} from '../../services/turnos';

function messageFrom(error: unknown): string {
  return error instanceof ApiError ? error.message : 'No se pudo completar la operación.';
}

export function useAppointments() {
  const turnos = ref<TurnoAgenda[]>([]);
  const cargando = ref(false);
  const error = ref<string | null>(null);

  async function execute<T>(operation: () => Promise<T>): Promise<T | null> {
    cargando.value = true;
    error.value = null;
    try {
      return await operation();
    } catch (reason) {
      error.value = messageFrom(reason);
      return null;
    } finally {
      cargando.value = false;
    }
  }

  async function cargar(): Promise<boolean> {
    const result = await execute(listarAgenda);
    if (result === null) return false;
    turnos.value = result;
    return true;
  }

  async function crear(datos: CrearTurnoInput): Promise<boolean> {
    const result = await execute(() => crearTurno(datos));
    return result !== null && cargar();
  }

  async function transicionar(id: string, estado: EstadoTurno): Promise<boolean> {
    const result = await execute(() => transicionarTurno(id, estado));
    return result !== null && cargar();
  }

  async function reservar(id: string, pacienteId: string): Promise<boolean> {
    const result = await execute(() => reservarTurno(id, pacienteId));
    return result !== null && cargar();
  }

  return { turnos, cargando, error, cargar, crear, transicionar, reservar };
}
