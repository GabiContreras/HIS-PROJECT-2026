import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CoverageType } from '../../../shared/events/coverage-type.js';
import { CoverageCatalogService } from './coverage-catalog.service.js';

function buildService() {
  const financiadores = { find: vi.fn(), findOne: vi.fn() };
  const planes = { find: vi.fn(), findOne: vi.fn() };
  const service = new CoverageCatalogService(
    financiadores as never,
    planes as never,
  );
  return { service, financiadores, planes };
}

describe('CoverageCatalogService', () => {
  it('lista solo financiadores activos ordenados por nombre', async () => {
    const { service, financiadores } = buildService();
    const activos = [
      { id: 'f1', nombre: 'OSDE', tipo: CoverageType.PREPAID, activo: true },
    ];
    financiadores.find.mockResolvedValue(activos);

    await expect(service.listActiveFinanciadores()).resolves.toBe(activos);
    expect(financiadores.find).toHaveBeenCalledWith({
      where: { activo: true },
      order: { nombre: 'ASC' },
    });
  });

  it('lista solo los planes activos de un financiador activo', async () => {
    const { service, planes } = buildService();
    planes.find.mockResolvedValue([]);

    await service.listActivePlanes('f1');

    expect(planes.find).toHaveBeenCalledWith({
      where: { financiadorId: 'f1', activo: true, financiador: { activo: true } },
      order: { nombre: 'ASC' },
    });
  });

  it('devuelve el financiador activo', async () => {
    const { service, financiadores } = buildService();
    const financiador = { id: 'f1', activo: true };
    financiadores.findOne.mockResolvedValue(financiador);

    await expect(service.getActiveFinanciador('f1')).resolves.toBe(financiador);
  });

  it('rechaza con 404 un financiador inexistente o inactivo', async () => {
    const { service, financiadores } = buildService();
    financiadores.findOne.mockResolvedValue(null);

    await expect(service.getActiveFinanciador('f1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('devuelve el plan activo que pertenece a un financiador activo', async () => {
    const { service, planes } = buildService();
    const plan = { id: 'p1', financiadorId: 'f1', activo: true };
    planes.findOne.mockResolvedValue(plan);

    await expect(service.getActivePlan('f1', 'p1')).resolves.toBe(plan);
    expect(planes.findOne).toHaveBeenCalledWith({
      where: {
        id: 'p1',
        financiadorId: 'f1',
        activo: true,
        financiador: { activo: true },
      },
    });
  });

  it('rechaza con 404 un plan que no pertenece al financiador o está inactivo', async () => {
    const { service, planes } = buildService();
    planes.findOne.mockResolvedValue(null);

    await expect(service.getActivePlan('f1', 'p9')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
