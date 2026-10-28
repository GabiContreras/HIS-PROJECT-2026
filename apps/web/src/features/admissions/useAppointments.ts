import { ref } from 'vue';
import { messageFrom } from '../../shared/errors';
import {
  crearEntreturno,
  crearTurno,
  listarAgenda,
  reservarTurno,
  transicionarTurno,
  type CrearTurnoInput,
  type EstadoTurno,
  type TurnoAgenda,
} from '../../services/turnos';

export function useAppointments() {
  const turnos = ref<TurnoAgenda[]>([]);
  const cargando = ref(false);
  const error = ref<string | null>(null);
  // Los errores de una acción no reemplazan la tabla: se muestran aparte.
  const actuando = ref(false);
  const errorAccion = ref<string | null>(null);

  async function cargar(): Promise<boolean> {
    cargando.value = true;
    error.value = null;
    try {
      turnos.value = await listarAgenda();
      return true;
    } catch (reason) {
      error.value = messageFrom(reason);
      return false;
    } finally {
      cargando.value = false;
    }
  }

  /** Ejecuta una acción y, si salió bien o falló por conflicto, refresca la agenda. */
  async function accion(operation: () => Promise<unknown>): Promise<boolean> {
    actuando.value = true;
    errorAccion.value = null;
    try {
      await operation();
      await cargar();
      return true;
    } catch (reason) {
      errorAccion.value = messageFrom(reason);
      await cargar();
      return false;
    } finally {
      actuando.value = false;
    }
  }

  return {
    turnos,
    cargando,
    error,
    actuando,
    errorAccion,
    cargar,
    crear: (datos: CrearTurnoInput) => accion(() => crearTurno(datos)),
    crearEntreturno: (datos: CrearTurnoInput) => accion(() => crearEntreturno(datos)),
    reservar: (id: string, pacienteId: string) => accion(() => reservarTurno(id, pacienteId)),
    transicionar: (id: string, estado: EstadoTurno) => accion(() => transicionarTurno(id, estado)),
  };
}
