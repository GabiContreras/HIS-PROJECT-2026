import { CoverageType } from '../../../shared/events/coverage-type.js';
import { COPAGO_PREPAGA_PESOS, coverageStrategyFor } from './coverage.strategy.js';

describe('Estrategias de cobertura (HU Facturación 1.1)', () => {
  it('obra social pública: el paciente paga 0 y el Estado cubre los 15.000', () => {
    expect(coverageStrategyFor(CoverageType.PUBLIC_INSURANCE).split(15_000)).toEqual({
      pacientePesos: 0,
      terceroPesos: 15_000,
    });
  });

  it('prepaga: copago de 3.000 para el paciente y 12.000 a reclamar a la prepaga', () => {
    expect(coverageStrategyFor(CoverageType.PREPAID).split(15_000)).toEqual({
      pacientePesos: 3_000,
      terceroPesos: 12_000,
    });
  });

  it('prepaga: el copago nunca supera el valor base', () => {
    expect(coverageStrategyFor(CoverageType.PREPAID).split(2_000)).toEqual({
      pacientePesos: 2_000,
      terceroPesos: 0,
    });
    expect(COPAGO_PREPAGA_PESOS).toBe(3_000);
  });

  it('particular: el paciente paga el 100%', () => {
    expect(coverageStrategyFor(CoverageType.SELF_PAY).split(15_000)).toEqual({
      pacientePesos: 15_000,
      terceroPesos: 0,
    });
  });

  it('el reparto siempre suma el valor base', () => {
    for (const tipo of Object.values(CoverageType)) {
      const { pacientePesos, terceroPesos } = coverageStrategyFor(tipo).split(25_000);
      expect(pacientePesos + terceroPesos).toBe(25_000);
    }
  });
});
