import { describe, expect, it } from 'vitest';
import {
  cargoStateFor,
  EstadoCargo,
  InvalidCargoTransitionError,
} from './estado-cargo.js';

describe('CargoState', () => {
  it.each([EstadoCargo.PENDIENTE, EstadoCargo.FACTURADO])(
    'permite pagar un cargo %s',
    (estado) => {
      expect(cargoStateFor(estado).pagar().estado).toBe(EstadoCargo.PAGADO);
    },
  );

  it.each([EstadoCargo.PENDIENTE, EstadoCargo.FACTURADO])(
    'permite anular un cargo %s',
    (estado) => {
      expect(cargoStateFor(estado).anular().estado).toBe(EstadoCargo.ANULADO);
    },
  );

  it.each([EstadoCargo.PAGADO, EstadoCargo.ANULADO])(
    'rechaza pagar y anular un cargo %s',
    (estado) => {
      expect(() => cargoStateFor(estado).pagar()).toThrow(
        InvalidCargoTransitionError,
      );
      expect(() => cargoStateFor(estado).anular()).toThrow(
        InvalidCargoTransitionError,
      );
    },
  );

  it('informa el estado de origen y la accion rechazada', () => {
    const error = (() => {
      try {
        cargoStateFor(EstadoCargo.PAGADO).anular();
      } catch (caught) {
        return caught as InvalidCargoTransitionError;
      }
    })();

    expect(error?.from).toBe(EstadoCargo.PAGADO);
    expect(error?.action).toBe('anular');
    expect(error?.message).toBe('No se puede anular un cargo en estado PAGADO.');
  });
});

describe('CargoState facturar', () => {
  it('pasa un cargo PENDIENTE a FACTURADO', () => {
    expect(cargoStateFor(EstadoCargo.PENDIENTE).facturar().estado).toBe(
      EstadoCargo.FACTURADO,
    );
  });

  it.each([EstadoCargo.FACTURADO, EstadoCargo.PAGADO, EstadoCargo.ANULADO])(
    'rechaza facturar un cargo %s',
    (estado) => {
      expect(() => cargoStateFor(estado).facturar()).toThrow(
        InvalidCargoTransitionError,
      );
    },
  );

  it('informa el estado de origen y la accion facturar', () => {
    const error = (() => {
      try {
        cargoStateFor(EstadoCargo.PAGADO).facturar();
      } catch (caught) {
        return caught as InvalidCargoTransitionError;
      }
    })();

    expect(error?.from).toBe(EstadoCargo.PAGADO);
    expect(error?.action).toBe('facturar');
    expect(error?.message).toBe('No se puede facturar un cargo en estado PAGADO.');
  });

  it('un cargo FACTURADO sigue pudiendo pagarse y anularse', () => {
    expect(cargoStateFor(EstadoCargo.FACTURADO).pagar().estado).toBe(EstadoCargo.PAGADO);
    expect(cargoStateFor(EstadoCargo.FACTURADO).anular().estado).toBe(EstadoCargo.ANULADO);
  });
});
