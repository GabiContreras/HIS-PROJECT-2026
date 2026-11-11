export const CLINIC_TIME_ZONE = 'America/Argentina/Buenos_Aires';
export const OPENING_HOUR = 8;
export const CLOSING_HOUR = 20;

const CLINIC_OFFSET = '-03:00';
const DAY_MS = 24 * 60 * 60_000;

const clock = new Intl.DateTimeFormat('es-AR', {
  timeZone: CLINIC_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
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

export function clinicTime(iso: string): string {
  const { hour, minute } = clockParts(iso);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function clinicEndTime(iso: string, durationMinutes: number): string {
  return clinicTime(new Date(new Date(iso).getTime() + durationMinutes * 60_000).toISOString());
}

export function isWithinClinicHours(iso: string, durationMinutes: number): boolean {
  const { hour, minute } = clockParts(iso);
  const start = hour * 60 + minute;
  return start >= OPENING_HOUR * 60 && start + durationMinutes <= CLOSING_HOUR * 60;
}

export function todayInClinic(): string {
  return day.format(new Date());
}

export function clinicDateOf(iso: string): string {
  return day.format(new Date(iso));
}

export function dayRange(date: string): { desde: string; hasta: string } {
  const start = new Date(`${date}T00:00:00${CLINIC_OFFSET}`);
  return { desde: start.toISOString(), hasta: new Date(start.getTime() + DAY_MS).toISOString() };
}

export function addDays(date: string, days: number): string {
  return day.format(new Date(new Date(`${date}T12:00:00${CLINIC_OFFSET}`).getTime() + days * DAY_MS));
}

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
