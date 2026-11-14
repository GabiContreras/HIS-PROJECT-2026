import { describe, expect, it } from 'vitest';
import { CoverageType } from '../../../shared/events/coverage-type.js';
import { isFinanciadorTipo } from './financiador-tipo.js';

describe('isFinanciadorTipo', () => {
  it('acepta obra social pública y medicina prepaga', () => {
    expect(isFinanciadorTipo(CoverageType.PUBLIC_INSURANCE)).toBe(true);
    expect(isFinanciadorTipo(CoverageType.PREPAID)).toBe(true);
  });

  it('rechaza particular porque no tiene financiador', () => {
    expect(isFinanciadorTipo(CoverageType.SELF_PAY)).toBe(false);
  });

  it('rechaza valores desconocidos', () => {
    expect(isFinanciadorTipo('OTRO')).toBe(false);
  });
});
