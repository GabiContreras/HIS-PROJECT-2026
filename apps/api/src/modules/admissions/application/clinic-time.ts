const CLINIC_TIME_ZONE = 'America/Argentina/Buenos_Aires';
// Argentina no tiene horario de verano: el desfase es fijo.
const CLINIC_OFFSET = '-03:00';
const DAY_MS = 24 * 60 * 60_000;

const clinicDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLINIC_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Día de la clínica (AAAA-MM-DD) de un instante. */
export function clinicDateOf(date: Date): string {
  return clinicDateFormat.format(date);
}

/** Límites ISO [desde, hasta) de un día de la clínica. */
export function clinicDayBounds(fecha: string): { desde: string; hasta: string } {
  const start = new Date(`${fecha}T00:00:00${CLINIC_OFFSET}`);
  return {
    desde: start.toISOString(),
    hasta: new Date(start.getTime() + DAY_MS).toISOString(),
  };
}
