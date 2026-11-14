import { describe, expect, it, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Cargo } from '../../../entities/cargo.entity.js';
import { EstadoCargo } from '../domain/estado-cargo.js';
import { BillingService } from './billing.service.js';

function buildService(cargo: Partial<Cargo> | null) {
  const findOne = vi.fn(async () => cargo);
  const save = vi.fn(async (entity: Cargo) => entity);
  const manager = { getRepository: () => ({ findOne, save }) };
  const transaction = vi.fn(async (work: (m: unknown) => unknown) =>
    work(manager),
  );
  const service = Object.create(BillingService.prototype) as BillingService;
  Object.assign(service, { cargos: { manager: { transaction } } });
  return { service, findOne, save };
}

describe('BillingService estado del cargo', () => {
  it.each([EstadoCargo.PENDIENTE, EstadoCargo.FACTURADO])(
    'paga un cargo %s',
    async (estado) => {
      const { service, save } = buildService({ id: 'c1', estado });

      const result = await service.pagar('c1');

      expect(result.estado).toBe(EstadoCargo.PAGADO);
      expect(save).toHaveBeenCalledTimes(1);
    },
  );

  it.each([EstadoCargo.PENDIENTE, EstadoCargo.FACTURADO])(
    'anula un cargo %s',
    async (estado) => {
      const { service } = buildService({ id: 'c1', estado });

      const result = await service.anular('c1');

      expect(result.estado).toBe(EstadoCargo.ANULADO);
    },
  );

  it('toma el cargo con bloqueo pesimista de escritura', async () => {
    const { service, findOne } = buildService({
      id: 'c1',
      estado: EstadoCargo.PENDIENTE,
    });

    await service.pagar('c1');

    expect(findOne).toHaveBeenCalledWith({
      where: { id: 'c1' },
      lock: { mode: 'pessimistic_write' },
    });
  });

  it.each([EstadoCargo.PAGADO, EstadoCargo.ANULADO])(
    'responde 409 al pagar un cargo %s y no guarda',
    async (estado) => {
      const { service, save } = buildService({ id: 'c1', estado });

      await expect(service.pagar('c1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(save).not.toHaveBeenCalled();
    },
  );

  it.each([EstadoCargo.PAGADO, EstadoCargo.ANULADO])(
    'responde 409 al anular un cargo %s y no guarda',
    async (estado) => {
      const { service, save } = buildService({ id: 'c1', estado });

      await expect(service.anular('c1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(save).not.toHaveBeenCalled();
    },
  );

  it('responde 404 si el cargo no existe', async () => {
    const { service } = buildService(null);

    await expect(service.pagar('c1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
