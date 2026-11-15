import { describe, expect, it, vi } from 'vitest';
import { TypeOrmNomencladorRepository } from './typeorm-nomenclador.repository.js';

function repoWith(prestacion: unknown, tarifa: unknown) {
  const prestaciones = { findOneBy: vi.fn().mockResolvedValue(prestacion) };
  const tarifas = { findOneBy: vi.fn().mockResolvedValue(tarifa) };
  return {
    repo: new TypeOrmNomencladorRepository(prestaciones as never, tarifas as never),
    prestaciones,
    tarifas,
  };
}

describe('TypeOrmNomencladorRepository', () => {
  it('busca la prestación solo entre las activas y la mapea', async () => {
    const { repo, prestaciones } = repoWith(
      { id: 'p1', codigo: 'CONSULTA_REGULAR', nombre: 'x', valorBasePesos: 15_000, copagoPesos: 3_000, activo: true },
      null,
    );

    expect(await repo.findPrestacionActiva('CONSULTA_REGULAR')).toEqual({
      id: 'p1',
      codigo: 'CONSULTA_REGULAR',
      valorBasePesos: 15_000,
      copagoPesos: 3_000,
    });
    expect(prestaciones.findOneBy).toHaveBeenCalledWith({ codigo: 'CONSULTA_REGULAR', activo: true });
  });

  it('devuelve null si no hay prestación activa', async () => {
    const { repo } = repoWith(null, null);
    expect(await repo.findPrestacionActiva('CONSULTA_REGULAR')).toBeNull();
  });

  it('busca la tarifa solo entre las activas y la mapea', async () => {
    const { repo, tarifas } = repoWith(null, { id: 't1', valorPesos: 18_000, copagoPesos: null, activo: true });

    expect(await repo.findTarifaActiva('f1', 'p1')).toEqual({ valorPesos: 18_000, copagoPesos: null });
    expect(tarifas.findOneBy).toHaveBeenCalledWith({ financiadorId: 'f1', prestacionId: 'p1', activo: true });
  });

  it('devuelve null si no hay tarifa activa', async () => {
    const { repo } = repoWith(null, null);
    expect(await repo.findTarifaActiva('f1', 'p1')).toBeNull();
  });
});
