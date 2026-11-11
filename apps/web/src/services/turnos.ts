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

export interface SlotDisponible {
  fechaHora: string;
  duracionMinutos: number;
  medico: {
    id: string;
    nombre: string;
    apellido: string;
  };
}

export interface ReservarTurnoInput {
  medicoId: string;
  fechaHora: string;
  pacienteId: string;
}

export interface PromocionStandby {
  turno: Turno;
  paciente: { id: string; nombre: string; apellido: string };
}

export type TurnoTransicionado = Turno & { promovido: PromocionStandby | null };

export interface EsperaItem {
  id: string;
  fecha: string;
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

export type TablaTransiciones = Record<EstadoTurno, EstadoTurno[]>;

export interface TurnosFiltro {
  medicoId?: string;
  desde?: string;
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

export function listarAgenda(filtro: TurnosFiltro = {}): Promise<TurnoAgenda[]> {
  return http.get<TurnoAgenda[]>(`/turnos/agenda${toQuery(filtro)}`);
}

export function listarDisponibles(filtro: TurnosFiltro = {}): Promise<SlotDisponible[]> {
  return http.get<SlotDisponible[]>(`/turnos/disponibles${toQuery(filtro)}`);
}

export function reservarTurno(datos: ReservarTurnoInput): Promise<Turno> {
  return http.post<Turno>('/turnos', datos);
}

export function reservarEntreturno(datos: ReservarTurnoInput): Promise<Turno> {
  return http.post<Turno>('/turnos/entreturno', datos);
}

export function obtenerTransiciones(): Promise<TablaTransiciones> {
  return http.get<TablaTransiciones>('/turnos/transiciones');
}

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

export function agregarEspera(datos: AgregarEsperaInput): Promise<EsperaItem> {
  return http.post<EsperaItem>('/turnos/espera', datos);
}

export function quitarEspera(id: string): Promise<void> {
  return http.delete(`/turnos/espera/${id}`);
}
