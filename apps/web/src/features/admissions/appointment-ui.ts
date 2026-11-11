import type { ChipTone } from '../../components/ui/StatusChip.vue';
import type { EstadoTurno, TurnoAgenda } from '../../services/turnos';

export const ESTADO_LABELS: Record<EstadoTurno, string> = {
  DISPONIBLE: 'Disponible',
  RESERVADO: 'Programado',
  CONFIRMADO: 'Confirmado',
  EN_SALA_DE_ESPERA: 'En sala de espera',
  ATENDIDO: 'Atendido',
  CANCELADO: 'Cancelado',
};

export const ESTADO_TONES: Record<EstadoTurno, ChipTone> = {
  DISPONIBLE: 'neutral',
  RESERVADO: 'info',
  CONFIRMADO: 'success',
  EN_SALA_DE_ESPERA: 'warning',
  ATENDIDO: 'dark',
  CANCELADO: 'danger',
};

export const patientName = (turno: TurnoAgenda): string =>
  turno.paciente ? `${turno.paciente.nombre} ${turno.paciente.apellido}` : 'Sin asignar';

export const doctorName = (turno: TurnoAgenda): string => `${turno.medico.nombre} ${turno.medico.apellido}`;

export const isShortened = (turno: TurnoAgenda): boolean => !turno.urgente && turno.duracionMinutos < 30;
