import { http } from '../shared/http';

export type EstadoTurno =
  | 'DISPONIBLE'
  | 'RESERVADO'
  | 'CONFIRMADO'
  | 'EN_SALA_DE_ESPERA'
  | 'ATENDIDO'
  | 'CANCELADO';

export interface Turno {
  id: string;
  fechaHora: string;
  duracionMinutos: number;
  estado: EstadoTurno;
  urgente: boolean;
  medico: {
    id: string;
    nombre: string;
    apellido: string;
  };
}

export interface TurnoAgenda extends Turno {
  paciente: {
    id: string;
    nombre: string;
    apellido: string;
  } | null;
}

/** Horario libre calculado por el backend (no tiene id: todavía no existe como turno). */
export interface SlotDisponible {
  fechaHora: string;
  /** 30, o 15 si un entreturno ocupa la segunda mitad del horario. */
  duracionMinutos: number;
  medico: {
    id: string;
    nombre: string;
    apellido: string;
  };
}

export interface ReservarTurnoInput {
  medicoId: string;
  /** Inicio del horario, ISO. Turno regular: :00/:30. Entreturno: :15/:45. */
  fechaHora: string;
  pacienteId: string;
}

/** Paciente de la lista de espera al que se le asignó el horario de un turno cancelado (HU 1.3). */
export interface PromocionStandby {
  turno: Turno;
  paciente: { id: string; nombre: string; apellido: string };
}

export type TurnoTransicionado = Turno & { promovido: PromocionStandby | null };

/** Lugar en la cola de espera de entreturnos de un médico para un día. */
export interface EsperaItem {
  id: string;
  /** AAAA-MM-DD */
  fecha: string;
  /** 1 = el próximo en recibir un horario. */
  posicion: number;
  creadoEn: string;
  medico: { id: string; nombre: string; apellido: string };
  paciente: { id: string; nombre: string; apellido: string };
}

export interface AgregarEsperaInput {
  medicoId: string;
  pacienteId: string;
  fecha: string;
}

/** Estado → estados a los que puede pasar. La fuente es el backend (State Pattern). */
export type TablaTransiciones = Record<EstadoTurno, EstadoTurno[]>;

export interface TurnosFiltro {
  medicoId?: string;
  /** ISO, inclusive. */
  desde?: string;
  /** ISO, exclusivo. */
  hasta?: string;
}

function toQuery(filtro: TurnosFiltro): string {
  const params = new URLSearchParams();
  if (filtro.medicoId) params.set('medicoId', filtro.medicoId);
  if (filtro.desde) params.set('desde', filtro.desde);
  if (filtro.hasta) params.set('hasta', filtro.hasta);
  const query = params.toString();
  return query ? `?${query}` : '';
}

/** Turnos reservados (con su paciente). Se puede acotar por médico y por rango de fechas. */
export function listarAgenda(filtro: TurnosFiltro = {}): Promise<TurnoAgenda[]> {
  return http.get<TurnoAgenda[]>(`/turnos/agenda${toQuery(filtro)}`);
}

/**
 * Horarios libres, calculados con el horario de cada médico. Los que ya pasaron no vienen.
 * Sin rango trae los próximos 7 días; el máximo es 31.
 */
export function listarDisponibles(filtro: TurnosFiltro = {}): Promise<SlotDisponible[]> {
  return http.get<SlotDisponible[]>(`/turnos/disponibles${toQuery(filtro)}`);
}

/** Reserva un horario libre para un paciente registrado. */
export function reservarTurno(datos: ReservarTurnoInput): Promise<Turno> {
  return http.post<Turno>('/turnos', datos);
}

/** Entreturno de 15 minutos a los :15/:45, dentro de un horario libre de 30 minutos. */
export function reservarEntreturno(datos: ReservarTurnoInput): Promise<Turno> {
  return http.post<Turno>('/turnos/entreturno', datos);
}

export function obtenerTransiciones(): Promise<TablaTransiciones> {
  return http.get<TablaTransiciones>('/turnos/transiciones');
}

/** Al cancelar, si había lista de espera, `promovido` trae a quién se le asignó el horario. */
export function transicionarTurno(id: string, estado: EstadoTurno): Promise<TurnoTransicionado> {
  return http.patch<TurnoTransicionado>(`/turnos/${id}/transiciones`, { estado });
}

export function listarEspera(filtro: { medicoId?: string; fecha?: string } = {}): Promise<EsperaItem[]> {
  const params = new URLSearchParams();
  if (filtro.medicoId) params.set('medicoId', filtro.medicoId);
  if (filtro.fecha) params.set('fecha', filtro.fecha);
  const query = params.toString();
  return http.get<EsperaItem[]>(`/turnos/espera${query ? `?${query}` : ''}`);
}

/** Solo si el médico no tiene horarios libres ese día. */
export function agregarEspera(datos: AgregarEsperaInput): Promise<EsperaItem> {
  return http.post<EsperaItem>('/turnos/espera', datos);
}

export function quitarEspera(id: string): Promise<void> {
  return http.delete(`/turnos/espera/${id}`);
}
