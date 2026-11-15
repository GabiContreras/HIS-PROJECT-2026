import { CoverageType } from '../../../shared/events/coverage-type.js';

/** Cómo se reparte el valor base de una prestación (HU de Facturación, épica 1). */
export interface CoverageBreakdown {
  /** Lo que paga el paciente. */
  pacientePesos: number;
  /** Lo que se le factura a un tercero: el Estado o la prepaga. */
  terceroPesos: number;
}

export interface CoverageStrategy {
  readonly tipo: CoverageType;
  split(valorBasePesos: number, copagoPesos: number): CoverageBreakdown;
}

/** Obra social pública: subsidia el 100%; el paciente abona cero. */
export class ObraSocialPublicaStrategy implements CoverageStrategy {
  readonly tipo = CoverageType.PUBLIC_INSURANCE;
  split(valorBasePesos: number): CoverageBreakdown {
    return { pacientePesos: 0, terceroPesos: valorBasePesos };
  }
}

/** Medicina prepaga: copago del nomenclador para el paciente; el resto se le reclama a la prepaga. */
export class MedicinaPrepagaStrategy implements CoverageStrategy {
  readonly tipo = CoverageType.PREPAID;
  split(valorBasePesos: number, copagoPesos: number): CoverageBreakdown {
    const copago = Math.min(copagoPesos, valorBasePesos);
    return { pacientePesos: copago, terceroPesos: valorBasePesos - copago };
  }
}

/** Particular (sin cobertura): el paciente paga el 100% del valor base. */
export class ParticularStrategy implements CoverageStrategy {
  readonly tipo = CoverageType.SELF_PAY;
  split(valorBasePesos: number): CoverageBreakdown {
    return { pacientePesos: valorBasePesos, terceroPesos: 0 };
  }
}

const STRATEGIES: Record<CoverageType, CoverageStrategy> = {
  [CoverageType.PUBLIC_INSURANCE]: new ObraSocialPublicaStrategy(),
  [CoverageType.PREPAID]: new MedicinaPrepagaStrategy(),
  [CoverageType.SELF_PAY]: new ParticularStrategy(),
};

export const coverageStrategyFor = (tipo: CoverageType): CoverageStrategy =>
  STRATEGIES[tipo];
