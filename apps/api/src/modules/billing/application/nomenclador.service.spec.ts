import { describe, expect, it, vi } from 'vitest';
import { PrestacionCodigo, PrestacionNoEncontradaError } from '../domain/nomenclador.js';
import { NomencladorService } from './nomenclador.service.js';

const prestacion = {
  id: 'p1',
  codigo: 'CONSULTA_REGULAR',
  valorBasePesos: 15_000,
  copagoPesos: 3_000,
};

function serviceWith(opts: {
  prestacion?: typeof prestacion | null;
  tarifa?: { valorPesos: number; copagoPesos: number | null } | null;
}) {
  const repo = {
    findPrestacionActiva: vi.fn().mockResolvedValue(opts.prestacion === undefined ? prestacion : opts.prestacion),
    findTarifaActiva: vi.fn().mockResolvedValue(opts.tarifa ?? null),
  };
  return { service: new NomencladorService(repo), repo };
}

describe('NomencladorService.resolve', () => {
  it('con tarifa del financiador usa su valor y su copago', async () => {
    const { service, repo } = serviceWith({ tarifa: { valorPesos: 18_000, copagoPesos: 2_000 } });

    expect(await service.resolve(PrestacionCodigo.CONSULTA_REGULAR, 'f1')).toEqual({
      valorPesos: 18_000,
      copagoPesos: 2_000,
    });
    expect(repo.findTarifaActiva).toHaveBeenCalledWith('f1', 'p1');
  });

  it('sin tarifa cae al valor base y al copago de la prestación', async () => {
    const { service } = serviceWith({ tarifa: null });

    expect(await service.resolve(PrestacionCodigo.CONSULTA_REGULAR, 'f1')).toEqual({
      valorPesos: 15_000,
      copagoPesos: 3_000,
    });
  });

  it('con tarifa de copago nulo usa el copago de la prestación', async () => {
    const { service } = serviceWith({ tarifa: { valorPesos: 18_000, copagoPesos: null } });

    expect(await service.resolve(PrestacionCodigo.CONSULTA_REGULAR, 'f1')).toEqual({
      valorPesos: 18_000,
      copagoPesos: 3_000,
    });
  });

  it('paciente particular o sin financiador: no busca tarifa y usa la prestación', async () => {
    const { service, repo } = serviceWith({ tarifa: { valorPesos: 99_999, copagoPesos: 1 } });

    expect(await service.resolve(PrestacionCodigo.CONSULTA_REGULAR, null)).toEqual({
      valorPesos: 15_000,
      copagoPesos: 3_000,
    });
    expect(repo.findTarifaActiva).not.toHaveBeenCalled();
  });

  it('una tarifa inactiva no la devuelve el puerto y se usa la prestación', async () => {
    const { service, repo } = serviceWith({ tarifa: null });

    const importe = await service.resolve(PrestacionCodigo.CONSULTA_REGULAR, 'f1');

    expect(repo.findTarifaActiva).toHaveBeenCalledTimes(1);
    expect(importe.valorPesos).toBe(15_000);
  });

  it('si la prestación no existe falla con un error claro y no inventa un importe', async () => {
    const { service, repo } = serviceWith({ prestacion: null });

    await expect(service.resolve(PrestacionCodigo.CONSULTA_REGULAR, 'f1')).rejects.toBeInstanceOf(
      PrestacionNoEncontradaError,
    );
    expect(repo.findTarifaActiva).not.toHaveBeenCalled();
  });
});
