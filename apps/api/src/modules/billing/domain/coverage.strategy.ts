import { CoverageType } from '../../../shared/events/coverage-type.js';

export interface CoverageBreakdown {
  pacientePesos: number;
  terceroPesos: number;
}

export interface CoverageStrategy {
  readonly tipo: CoverageType;
  split(valorBasePesos: number): CoverageBreakdown;
}

export const COPAGO_PREPAGA_PESOS = 3_000;

export class ObraSocialPublicaStrategy implements CoverageStrategy {
  readonly tipo = CoverageType.PUBLIC_INSURANCE;
  split(valorBasePesos: number): CoverageBreakdown {
    return { pacientePesos: 0, terceroPesos: valorBasePesos };
  }
}

export class MedicinaPrepagaStrategy implements CoverageStrategy {
  readonly tipo = CoverageType.PREPAID;
  split(valorBasePesos: number): CoverageBreakdown {
    const copago = Math.min(COPAGO_PREPAGA_PESOS, valorBasePesos);
    return { pacientePesos: copago, terceroPesos: valorBasePesos - copago };
  }
}

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
