import { ref } from 'vue';
import { messageFrom } from '../../shared/errors';
import {
  agregarEspera,
  listarAgenda,
  listarEspera,
  listarDisponibles,
  obtenerTransiciones,
  quitarEspera,
  reservarEntreturno,
  reservarTurno,
  transicionarTurno,
  type AgregarEsperaInput,
  type EsperaItem,
  type EstadoTurno,
  type PromocionStandby,
  type ReservarTurnoInput,
  type SlotDisponible,
  type TablaTransiciones,
  type TurnoAgenda,
} from '../../services/turnos';
import { dayRange, todayInClinic } from './clinic-hours';

export function useAppointments() {
  const fecha = ref(todayInClinic());
  const medicoId = ref('');

  const turnos = ref<TurnoAgenda[]>([]);
  const libres = ref<SlotDisponible[]>([]);
  const espera = ref<EsperaItem[]>([]);
  const promovido = ref<PromocionStandby | null>(null);
  const transiciones = ref<TablaTransiciones | null>(null);
  const cargando = ref(false);
  const error = ref<string | null>(null);
  const actuando = ref(false);
  const errorAccion = ref<string | null>(null);

  async function cargar(): Promise<boolean> {
    cargando.value = true;
    error.value = null;
    const filtro = { medicoId: medicoId.value || undefined, ...dayRange(fecha.value) };
    try {
      const [agenda, disponibles, enEspera] = await Promise.all([
        listarAgenda(filtro),
        listarDisponibles(filtro),
        listarEspera({ medicoId: medicoId.value || undefined, fecha: fecha.value }),
      ]);
      turnos.value = agenda;
      libres.value = disponibles;
      espera.value = enEspera;
      transiciones.value ??= await obtenerTransiciones();
      return true;
    } catch (reason) {
      error.value = messageFrom(reason);
      return false;
    } finally {
      cargando.value = false;
    }
  }

  function puedePasar(desde: EstadoTurno, hacia: EstadoTurno): boolean {
    return transiciones.value?.[desde]?.includes(hacia) ?? false;
  }

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
    fecha,
    medicoId,
    turnos,
    libres,
    espera,
    promovido,
    cargando,
    error,
    actuando,
    errorAccion,
    cargar,
    puedePasar,
    reservar: (datos: ReservarTurnoInput) => accion(() => reservarTurno(datos)),
    reservarEntreturno: (datos: ReservarTurnoInput) => accion(() => reservarEntreturno(datos)),
    transicionar: (id: string, estado: EstadoTurno) => {
      promovido.value = null;
      return accion(async () => {
        const result = await transicionarTurno(id, estado);
        promovido.value = result.promovido;
      });
    },
    agregarEspera: (datos: AgregarEsperaInput) => accion(() => agregarEspera(datos)),
    quitarEspera: (id: string) => accion(() => quitarEspera(id)),
  };
}
