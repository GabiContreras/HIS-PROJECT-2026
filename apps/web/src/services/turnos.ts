import { http } from '../shared/http';

export type EstadoTurno =
  | 'DISPONIBLE'
  | 'RESERVADO'
  | 'CONFIRMADO'
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

export interface CrearTurnoInput {
  medicoId: string;
  fechaHora: string;
}

export interface DisponiblesFiltro {
  medicoId?: string;
  /** ISO, inclusive. */
  desde?: string;
  /** ISO, exclusivo. */
  hasta?: string;
}

function toQuery(filtro: DisponiblesFiltro): string {
  const params = new URLSearchParams();
  if (filtro.medicoId) params.set('medicoId', filtro.medicoId);
  if (filtro.desde) params.set('desde', filtro.desde);
  if (filtro.hasta) params.set('hasta', filtro.hasta);
  const query = params.toString();
  return query ? `?${query}` : '';
}

/** Todos los turnos (libres y ocupados), con su paciente. Se puede acotar por médico y por rango de fechas. */
export function listarAgenda(filtro: DisponiblesFiltro = {}): Promise<TurnoAgenda[]> {
  return http.get<TurnoAgenda[]>(`/turnos/agenda${toQuery(filtro)}`);
}

/** Turnos libres (los que ya pasaron no vienen). Se puede acotar por médico y por rango de fechas. */
export function listarDisponibles(filtro: DisponiblesFiltro = {}): Promise<Turno[]> {
  return http.get<Turno[]>(`/turnos/disponibles${toQuery(filtro)}`);
}

export function crearTurno(datos: CrearTurnoInput): Promise<Turno> {
  return http.post<Turno>('/turnos', datos);
}

export function transicionarTurno(id: string, estado: EstadoTurno): Promise<Turno> {
  return http.patch<Turno>(`/turnos/${id}/transiciones`, { estado });
}

export function reservarTurno(id: string, pacienteId: string): Promise<Turno> {
  return http.patch<Turno>(`/turnos/${id}/reservar`, { pacienteId });
}

/** Entreturno de 15 minutos: debe empezar en :15 o :45 entre dos turnos de 30 minutos. */
export function crearEntreturno(datos: CrearTurnoInput): Promise<Turno> {
  return http.post<Turno>('/turnos/urgencia', datos);
}
