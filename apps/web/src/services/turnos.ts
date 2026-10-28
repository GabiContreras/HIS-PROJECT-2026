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

export function listarAgenda(): Promise<TurnoAgenda[]> {
  return http.get<TurnoAgenda[]>('/turnos/agenda');
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
