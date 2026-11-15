import { describe, expect, it } from 'vitest';
import {
  PrestacionCodigo,
  PrestacionNoEncontradaError,
  resolverImporte,
} from './nomenclador.js';
import { ConsultaRegularStrategy } from './consulta-regular.strategy.js';
import { ConsultaUrgenciaStrategy } from './consulta-urgencia.strategy.js';
import { TipoAtencionFacturable } from './tipo-atencion-facturable.js';

const prestacion = {
  id: 'p1',
  codigo: 'CONSULTA_REGULAR',
  valorBasePesos: 15_000,
  copagoPesos: 3_000,
};

describe('Nomenclador: resolución del importe', () => {
  it('sin tarifa usa el valor base y el copago de la prestación', () => {
    expect(resolverImporte(prestacion, null)).toEqual({ valorPesos: 15_000, copagoPesos: 3_000 });
  });

  it('con tarifa usa su valor y su copago', () => {
    expect(resolverImporte(prestacion, { valorPesos: 18_000, copagoPesos: 2_000 })).toEqual({
      valorPesos: 18_000,
      copagoPesos: 2_000,
    });
  });

  it('con tarifa de copago nulo usa el copago de la prestación', () => {
    expect(resolverImporte(prestacion, { valorPesos: 18_000, copagoPesos: null })).toEqual({
      valorPesos: 18_000,
      copagoPesos: 3_000,
    });
  });

  it('una tarifa con copago cero se respeta', () => {
    expect(resolverImporte(prestacion, { valorPesos: 18_000, copagoPesos: 0 })).toEqual({
      valorPesos: 18_000,
      copagoPesos: 0,
    });
  });
});

describe('Nomenclador: prestación de cada tipo de atención', () => {
  it('REGULAR corresponde a CONSULTA_REGULAR y URGENCIA a CONSULTA_URGENCIA', () => {
    const regular = new ConsultaRegularStrategy();
    const urgencia = new ConsultaUrgenciaStrategy();
    expect(regular.tipoAtencion).toBe(TipoAtencionFacturable.REGULAR);
    expect(regular.prestacion).toBe(PrestacionCodigo.CONSULTA_REGULAR);
    expect(urgencia.tipoAtencion).toBe(TipoAtencionFacturable.URGENCIA);
    expect(urgencia.prestacion).toBe(PrestacionCodigo.CONSULTA_URGENCIA);
  });

  it('el error de prestación faltante nombra el código', () => {
    expect(new PrestacionNoEncontradaError('CONSULTA_REGULAR').message).toContain('CONSULTA_REGULAR');
  });
});
