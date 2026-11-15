export type AgrupacionPeriodo = 'dia' | 'mes';

export const AGRUPACIONES_PERIODO: AgrupacionPeriodo[] = ['dia', 'mes'];

export const SIN_MEDICO_ASIGNADO = 'Sin médico asignado';

export interface ImportesCargos {
  cantidad: number;
  totalPesos: number;
  pacientePesos: number;
  terceroPesos: number;
}

export interface AnuladosPeriodo {
  cantidad: number;
  totalPesos: number;
}

export function sumarImportes(filas: ImportesCargos[]): ImportesCargos {
  return filas.reduce(
    (acumulado, fila) => ({
      cantidad: acumulado.cantidad + fila.cantidad,
      totalPesos: acumulado.totalPesos + fila.totalPesos,
      pacientePesos: acumulado.pacientePesos + fila.pacientePesos,
      terceroPesos: acumulado.terceroPesos + fila.terceroPesos,
    }),
    { cantidad: 0, totalPesos: 0, pacientePesos: 0, terceroPesos: 0 },
  );
}

export function ordenarPorImporte<T extends ImportesCargos>(
  filas: T[],
  nombreDe: (fila: T) => string,
): T[] {
  return [...filas].sort(
    (a, b) => b.totalPesos - a.totalPesos || nombreDe(a).localeCompare(nombreDe(b), 'es'),
  );
}
