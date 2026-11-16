import { describe, expect, it } from 'vitest';
import { EstadoCargo } from './estado-cargo.js';
import {
  CargoParaLiquidar,
  ESTADO_FACTURADO,
  esCargoLiquidable,
  estadosFacturables,
  totalTerceroPesos,
} from './liquidacion.js';
import { armarPeriodo } from './periodo-reporte.js';

const FINANCIADOR = 'fin-1';
const OTRO_FINANCIADOR = 'fin-2';
const periodo = armarPeriodo('2026-03-01', '2026-03-31');

function cargo(cambios: Partial<CargoParaLiquidar> = {}): CargoParaLiquidar {
  return {
    financiadorId: FINANCIADOR,
    estado: EstadoCargo.PENDIENTE,
    importeTerceroPesos: 12_000,
    createdAt: new Date('2026-03-10T15:00:00.000Z'),
    liquidacionId: null,
    ...cambios,
  };
}

const liquidable = (c: CargoParaLiquidar) => esCargoLiquidable(c, FINANCIADOR, periodo);

describe('estadosFacturables', () => {
  it('solo PENDIENTE puede pasar a FACTURADO', () => {
    expect(estadosFacturables()).toEqual([EstadoCargo.PENDIENTE]);
  });

  it('el estado destino es FACTURADO', () => {
    expect(ESTADO_FACTURADO).toBe(EstadoCargo.FACTURADO);
  });
});

describe('esCargoLiquidable', () => {
  it('incluye un cargo pendiente del financiador con tercero mayor a cero dentro del periodo', () => {
    expect(liquidable(cargo())).toBe(true);
  });

  it('incluye obra social publica (total) y prepaga (total menos copago)', () => {
    expect(liquidable(cargo({ importeTerceroPesos: 120_000 }))).toBe(true);
    expect(liquidable(cargo({ importeTerceroPesos: 117_500 }))).toBe(true);
  });

  it('excluye el particular con tercero cero y el que no tiene importe de tercero', () => {
    expect(liquidable(cargo({ importeTerceroPesos: 0 }))).toBe(false);
    expect(liquidable(cargo({ importeTerceroPesos: null }))).toBe(false);
  });

  it('excluye los cargos sin financiador y los de otro financiador', () => {
    expect(liquidable(cargo({ financiadorId: null }))).toBe(false);
    expect(liquidable(cargo({ financiadorId: OTRO_FINANCIADOR }))).toBe(false);
  });

  it.each([EstadoCargo.FACTURADO, EstadoCargo.PAGADO, EstadoCargo.ANULADO])(
    'excluye un cargo %s',
    (estado) => {
      expect(liquidable(cargo({ estado }))).toBe(false);
    },
  );

  it('excluye un cargo que ya esta en una liquidacion', () => {
    expect(liquidable(cargo({ liquidacionId: 'liq-1' }))).toBe(false);
  });

  it('excluye los cargos fuera del periodo', () => {
    expect(liquidable(cargo({ createdAt: new Date('2026-02-28T14:59:59.000Z') }))).toBe(false);
    expect(liquidable(cargo({ createdAt: new Date('2026-04-01T03:00:00.000Z') }))).toBe(false);
  });

  it('respeta los bordes del periodo en hora de Buenos Aires', () => {
    expect(liquidable(cargo({ createdAt: new Date('2026-03-01T03:00:00.000Z') }))).toBe(true);
    expect(liquidable(cargo({ createdAt: new Date('2026-03-01T02:59:59.000Z') }))).toBe(false);
    expect(liquidable(cargo({ createdAt: new Date('2026-04-01T02:59:59.000Z') }))).toBe(true);
  });

  it('un cargo de las 23:30 locales del ultimo dia entra y el de las 00:30 del dia siguiente no', () => {
    expect(liquidable(cargo({ createdAt: new Date('2026-04-01T02:30:00.000Z') }))).toBe(true);
    expect(liquidable(cargo({ createdAt: new Date('2026-04-01T03:30:00.000Z') }))).toBe(false);
  });
});

describe('totalTerceroPesos', () => {
  it('suma el importe de tercero de los cargos', () => {
    expect(
      totalTerceroPesos([
        { importeTerceroPesos: 120_000 },
        { importeTerceroPesos: 117_500 },
        { importeTerceroPesos: 1 },
      ]),
    ).toBe(237_501);
  });

  it('una lista vacia suma cero y el tercero nulo cuenta como cero', () => {
    expect(totalTerceroPesos([])).toBe(0);
    expect(totalTerceroPesos([{ importeTerceroPesos: null }, { importeTerceroPesos: 5 }])).toBe(5);
  });

  it('rechaza un total que no es un entero seguro', () => {
    expect(() =>
      totalTerceroPesos([
        { importeTerceroPesos: Number.MAX_SAFE_INTEGER },
        { importeTerceroPesos: 10 },
      ]),
    ).toThrow('El total de la liquidación no es válido.');
  });
});
