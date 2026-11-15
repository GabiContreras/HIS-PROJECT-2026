export enum PrestacionCodigo {
  CONSULTA_REGULAR = 'CONSULTA_REGULAR',
  CONSULTA_URGENCIA = 'CONSULTA_URGENCIA',
}

export interface PrestacionData {
  id: string;
  codigo: string;
  valorBasePesos: number;
  copagoPesos: number;
}

export interface TarifaData {
  valorPesos: number;
  copagoPesos: number | null;
}

export interface ImporteResuelto {
  valorPesos: number;
  copagoPesos: number;
}

export class PrestacionNoEncontradaError extends Error {
  constructor(codigo: string) {
    super(`La prestación ${codigo} no existe o está inactiva en el nomenclador.`);
  }
}

export function resolverImporte(
  prestacion: PrestacionData,
  tarifa: TarifaData | null,
): ImporteResuelto {
  if (!tarifa) {
    return {
      valorPesos: prestacion.valorBasePesos,
      copagoPesos: prestacion.copagoPesos,
    };
  }
  return {
    valorPesos: tarifa.valorPesos,
    copagoPesos: tarifa.copagoPesos ?? prestacion.copagoPesos,
  };
}
