export const HOSPITAL_TIME_ZONE = 'America/Argentina/Buenos_Aires';

export class EstadiaInvalidaError extends Error {}

const MS_POR_DIA = 24 * 60 * 60 * 1000;

const formatoDia = new Intl.DateTimeFormat('en-CA', {
  timeZone: HOSPITAL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function diaCalendario(fecha: Date): number {
  const [anio, mes, dia] = formatoDia
    .format(fecha)
    .split('-')
    .map((parte) => Number(parte));
  return Date.UTC(anio, mes - 1, dia) / MS_POR_DIA;
}

function parsearFecha(valor: string, nombre: string): Date {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    throw new EstadiaInvalidaError(`La fecha de ${nombre} no es válida: ${valor}.`);
  }
  return fecha;
}

export function calcularDiasCama(fechaIngreso: string, fechaEgreso: string): number {
  const ingreso = parsearFecha(fechaIngreso, 'ingreso');
  const egreso = parsearFecha(fechaEgreso, 'egreso');
  if (egreso.getTime() < ingreso.getTime()) {
    throw new EstadiaInvalidaError('La fecha de egreso es anterior a la de ingreso.');
  }
  return Math.max(1, diaCalendario(egreso) - diaCalendario(ingreso));
}
