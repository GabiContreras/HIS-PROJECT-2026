import { HOSPITAL_TIME_ZONE } from './dias-cama.js';

export class PeriodoInvalidoError extends Error {}

export interface PeriodoReporte {
  desde: string;
  hasta: string;
  inicio: Date;
  finExclusivo: Date;
}

const FORMATO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

const formatoPartes = new Intl.DateTimeFormat('en-US', {
  timeZone: HOSPITAL_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function desfaseMs(instante: number): number {
  const partes = Object.fromEntries(
    formatoPartes
      .formatToParts(new Date(instante))
      .map((parte) => [parte.type, Number(parte.value)]),
  );
  const local = Date.UTC(
    partes.year,
    partes.month - 1,
    partes.day,
    partes.hour,
    partes.minute,
    partes.second,
  );
  return local - Math.floor(instante / 1000) * 1000;
}

function inicioDelDia(anio: number, mes: number, dia: number): Date {
  const local = Date.UTC(anio, mes - 1, dia);
  const primero = local - desfaseMs(local);
  return new Date(local - desfaseMs(primero));
}

function parsearDia(valor: string, nombre: string): [number, number, number] {
  const coincidencia = FORMATO_FECHA.exec(valor ?? '');
  if (!coincidencia) {
    throw new PeriodoInvalidoError(
      `La fecha "${nombre}" debe tener el formato YYYY-MM-DD.`,
    );
  }
  const [anio, mes, dia] = [coincidencia[1], coincidencia[2], coincidencia[3]].map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  ) {
    throw new PeriodoInvalidoError(`La fecha "${nombre}" no existe en el calendario: ${valor}.`);
  }
  return [anio, mes, dia];
}

export function armarPeriodo(desde: string, hasta: string): PeriodoReporte {
  const [anioDesde, mesDesde, diaDesde] = parsearDia(desde, 'desde');
  const [anioHasta, mesHasta, diaHasta] = parsearDia(hasta, 'hasta');
  if (desde > hasta) {
    throw new PeriodoInvalidoError('La fecha "desde" no puede ser posterior a "hasta".');
  }
  return {
    desde,
    hasta,
    inicio: inicioDelDia(anioDesde, mesDesde, diaDesde),
    finExclusivo: inicioDelDia(anioHasta, mesHasta, diaHasta + 1),
  };
}
