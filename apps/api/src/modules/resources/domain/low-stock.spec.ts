import { describe, it, expect } from 'vitest';
import { cruzaStockMinimo } from './low-stock.js';

describe('cruzaStockMinimo', () => {
  it('cruza cuando el stock queda justo en el mínimo', () => {
    expect(cruzaStockMinimo(8, 5, 5)).toBe(true);
  });

  it('cruza cuando el stock queda por debajo del mínimo', () => {
    expect(cruzaStockMinimo(8, 3, 5)).toBe(true);
  });

  it('no cruza cuando el stock queda por encima del mínimo', () => {
    expect(cruzaStockMinimo(8, 6, 5)).toBe(false);
  });

  it('no cruza cuando el stock anterior ya estaba justo en el mínimo', () => {
    expect(cruzaStockMinimo(5, 4, 5)).toBe(false);
  });

  it('no cruza cuando el stock anterior ya estaba por debajo del mínimo', () => {
    expect(cruzaStockMinimo(3, 1, 5)).toBe(false);
  });

  it('cruza cuando el stock anterior es el mínimo más uno y queda en el mínimo', () => {
    expect(cruzaStockMinimo(6, 5, 5)).toBe(true);
  });

  it('con mínimo 0 nunca cruza, ni al llegar a 0', () => {
    expect(cruzaStockMinimo(3, 0, 0)).toBe(false);
    expect(cruzaStockMinimo(1, 0, 0)).toBe(false);
  });

  it('cruza cuando un descuento lleva el stock a 0 con un mínimo configurado', () => {
    expect(cruzaStockMinimo(5, 0, 4)).toBe(true);
    expect(cruzaStockMinimo(4, 0, 4)).toBe(false);
  });

  it('una reposición (stock resultante mayor al anterior) nunca cruza', () => {
    expect(cruzaStockMinimo(2, 12, 5)).toBe(false);
    expect(cruzaStockMinimo(5, 6, 5)).toBe(false);
    expect(cruzaStockMinimo(0, 20, 5)).toBe(false);
  });

  it('un valor de mínimo inválido no cruza', () => {
    expect(cruzaStockMinimo(8, 5, Number.NaN)).toBe(false);
  });
});
