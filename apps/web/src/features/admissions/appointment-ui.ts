import type { ChipTone } from '../../components/ui/StatusChip.vue';
import type { EstadoTurno, TurnoAgenda } from '../../services/turnos';

// "Programado" es el nombre que usan las historias de usuario para el turno reservado.
export const ESTADO_LABELS: Record<EstadoTurno, string> = {
  DISPONIBLE: 'Disponible',
  RESERVADO: 'Programado',
  CONFIRMADO: 'Confirmado',
  ATENDIDO: 'Atendido',
  CANCELADO: 'Cancelado',
};

export const ESTADO_TONES: Record<EstadoTurno, ChipTone> = {
  DISPONIBLE: 'neutral',
  RESERVADO: 'info',
  CONFIRMADO: 'success',
  ATENDIDO: 'dark',
  CANCELADO: 'danger',
};

export const patientName = (turno: TurnoAgenda): string =>
  turno.paciente ? `${turno.paciente.nombre} ${turno.paciente.apellido}` : 'Sin asignar';

export const doctorName = (turno: TurnoAgenda): string => `${turno.medico.nombre} ${turno.medico.apellido}`;

/** Un turno de menos de 30 minutos que no es entreturno quedó acortado por uno insertado al lado. */
export const isShortened = (turno: TurnoAgenda): boolean => !turno.urgente && turno.duracionMinutos < 30;
