// Horario de atención de la clínica. Los turnos regulares se dan de 08:00 a 20:00;
// las urgencias (entreturnos) no tienen restricción horaria: son las 24 horas.
export const CLINIC_TIME_ZONE = 'America/Argentina/Buenos_Aires';
export const OPENING_HOUR = 8;
export const CLOSING_HOUR = 20;

// Argentina no usa horario de verano: el desfase es siempre -03:00.
const CLINIC_OFFSET = '-03:00';
const DAY_MS = 24 * 60 * 60_000;

const clock = new Intl.DateTimeFormat('es-AR', {
  timeZone: CLINIC_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
// 'en-CA' formatea la fecha como AAAA-MM-DD, el mismo formato que usa <input type="date">.
const day = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLINIC_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function clockParts(iso: string): { hour: number; minute: number } {
  const parts = clock.formatToParts(new Date(iso));
  const read = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { hour: read('hour'), minute: read('minute') };
}

/** Hora del turno como "08:30", siempre en la hora de la clínica. */
export function clinicTime(iso: string): string {
  const { hour, minute } = clockParts(iso);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Hora en que termina el turno ("10:30"), en la hora de la clínica. */
export function clinicEndTime(iso: string, durationMinutes: number): string {
  return clinicTime(new Date(new Date(iso).getTime() + durationMinutes * 60_000).toISOString());
}

/** Un turno regular tiene que empezar y terminar dentro del horario de atención. */
export function isWithinClinicHours(iso: string, durationMinutes: number): boolean {
  const { hour, minute } = clockParts(iso);
  const start = hour * 60 + minute;
  return start >= OPENING_HOUR * 60 && start + durationMinutes <= CLOSING_HOUR * 60;
}

/** Fecha (AAAA-MM-DD) de hoy en la clínica. */
export function todayInClinic(): string {
  return day.format(new Date());
}

/** Fecha (AAAA-MM-DD) en la que cae un instante, en la clínica. */
export function clinicDateOf(iso: string): string {
  return day.format(new Date(iso));
}

/** Límites ISO del día completo, para pedirle a la API los turnos de esa fecha. */
export function dayRange(date: string): { desde: string; hasta: string } {
  const start = new Date(`${date}T00:00:00${CLINIC_OFFSET}`);
  return { desde: start.toISOString(), hasta: new Date(start.getTime() + DAY_MS).toISOString() };
}

/** "Martes, 15 de octubre de 2024" */
export function longDateLabel(date: string): string {
  const label = new Date(`${date}T12:00:00${CLINIC_OFFSET}`).toLocaleDateString('es-AR', {
    timeZone: CLINIC_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
