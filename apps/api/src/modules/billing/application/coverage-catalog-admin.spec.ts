import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CoverageType } from '../../../shared/events/coverage-type.js';
import { CoverageCatalogService } from './coverage-catalog.service.js';

const uniqueViolation = () =>
  Object.assign(new Error('duplicate key'), { code: '23505' });

function buildService() {
  const financiadores = {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn((input: object) => ({ ...input })),
    save: vi.fn(async (entry: object) => ({ id: 'saved', ...entry })),
  };
  const planes = {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn((input: object) => ({ ...input })),
    save: vi.fn(async (entry: object) => ({ id: 'saved', ...entry })),
  };
  const service = new CoverageCatalogService(
    financiadores as never,
    planes as never,
  );
  return { service, financiadores, planes };
}

describe('CoverageCatalogService administration', () => {
  it('agrupa los planes, activos e inactivos, bajo cada financiador', async () => {
    const { service, financiadores, planes } = buildService();
    financiadores.find.mockResolvedValue([
      { id: 'f1', nombre: 'OSDE', activo: false },
      { id: 'f2', nombre: 'PAMI', activo: true },
    ]);
    planes.find.mockResolvedValue([
      { id: 'p1', financiadorId: 'f1', activo: false },
      { id: 'p2', financiadorId: 'f1', activo: true },
    ]);

    const result = await service.listFinanciadoresWithPlanes();

    expect(result.map((f) => [f.id, f.planes.length])).toEqual([
      ['f1', 2],
      ['f2', 0],
    ]);
    expect(financiadores.find).toHaveBeenCalledWith({ order: { nombre: 'ASC' } });
  });

  it('crea un financiador', async () => {
    const { service, financiadores } = buildService();

    const created = await service.createFinanciador({
      nombre: 'OSDE',
      tipo: CoverageType.PREPAID,
    });

    expect(financiadores.save).toHaveBeenCalledWith({
      nombre: 'OSDE',
      tipo: CoverageType.PREPAID,
    });
    expect(created.id).toBe('saved');
  });

  it('responde 409 si el nombre del financiador ya existe', async () => {
    const { service, financiadores } = buildService();
    financiadores.save.mockRejectedValue(uniqueViolation());

    await expect(
      service.createFinanciador({ nombre: 'osde', tipo: CoverageType.PREPAID }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('reconoce el codigo de violacion unica dentro de driverError', async () => {
    const { service, financiadores } = buildService();
    financiadores.save.mockRejectedValue({ driverError: { code: '23505' } });

    await expect(
      service.createFinanciador({ nombre: 'osde', tipo: CoverageType.PREPAID }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('propaga los errores que no son de nombre duplicado', async () => {
    const { service, financiadores } = buildService();
    const boom = new Error('connection lost');
    financiadores.save.mockRejectedValue(boom);

    await expect(
      service.createFinanciador({ nombre: 'OSDE', tipo: CoverageType.PREPAID }),
    ).rejects.toBe(boom);
  });

  it('actualiza solo los campos enviados y permite la baja logica', async () => {
    const { service, financiadores } = buildService();
    financiadores.findOne.mockResolvedValue({
      id: 'f1',
      nombre: 'OSDE',
      tipo: CoverageType.PREPAID,
      activo: true,
    });

    await service.updateFinanciador('f1', { activo: false });

    expect(financiadores.save).toHaveBeenCalledWith({
      id: 'f1',
      nombre: 'OSDE',
      tipo: CoverageType.PREPAID,
      activo: false,
    });
  });

  it('responde 404 al editar un financiador inexistente', async () => {
    const { service, financiadores } = buildService();
    financiadores.findOne.mockResolvedValue(null);

    await expect(
      service.updateFinanciador('x', { nombre: 'A' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('responde 409 al renombrar un financiador con un nombre ya usado', async () => {
    const { service, financiadores } = buildService();
    financiadores.findOne.mockResolvedValue({ id: 'f1', nombre: 'A' });
    financiadores.save.mockRejectedValue(uniqueViolation());

    await expect(
      service.updateFinanciador('f1', { nombre: 'B' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('crea un plan bajo un financiador existente, incluso inactivo', async () => {
    const { service, financiadores, planes } = buildService();
    financiadores.findOne.mockResolvedValue({ id: 'f1', activo: false });

    await service.createPlan('f1', { nombre: '210' });

    expect(financiadores.findOne).toHaveBeenCalledWith({ where: { id: 'f1' } });
    expect(planes.save).toHaveBeenCalledWith({ financiadorId: 'f1', nombre: '210' });
  });

  it('responde 404 al crear un plan de un financiador inexistente', async () => {
    const { service, financiadores, planes } = buildService();
    financiadores.findOne.mockResolvedValue(null);

    await expect(
      service.createPlan('x', { nombre: '210' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(planes.save).not.toHaveBeenCalled();
  });

  it('responde 409 si el financiador ya tiene un plan con ese nombre', async () => {
    const { service, financiadores, planes } = buildService();
    financiadores.findOne.mockResolvedValue({ id: 'f1' });
    planes.save.mockRejectedValue(uniqueViolation());

    await expect(
      service.createPlan('f1', { nombre: '210' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('actualiza un plan y responde 404 si no existe', async () => {
    const { service, planes } = buildService();
    planes.findOne.mockResolvedValueOnce({ id: 'p1', nombre: 'A', activo: true });

    await service.updatePlan('p1', { nombre: 'B', activo: false });
    expect(planes.save).toHaveBeenCalledWith({
      id: 'p1',
      nombre: 'B',
      activo: false,
    });

    planes.findOne.mockResolvedValueOnce(null);
    await expect(service.updatePlan('x', { activo: true })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('responde 409 al renombrar un plan con un nombre ya usado', async () => {
    const { service, planes } = buildService();
    planes.findOne.mockResolvedValue({ id: 'p1', nombre: 'A' });
    planes.save.mockRejectedValue(uniqueViolation());

    await expect(
      service.updatePlan('p1', { nombre: 'B' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
