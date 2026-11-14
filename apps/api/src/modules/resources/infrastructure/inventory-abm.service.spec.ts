import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { InventoryService } from './inventory.service.js';

describe('InventoryService ABM', () => {
  let service: InventoryService;
  let queryBuilder: Record<string, ReturnType<typeof vi.fn>>;
  let repository: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };

  const rawInsumo = {
    id: 'insumo-1',
    nombre: 'Gasa',
    unidad_medida: 'caja',
    cantidad_disponible: 8,
    precio_pesos: 300,
    stock_minimo: 5,
  };

  beforeEach(() => {
    queryBuilder = {
      update: vi.fn(),
      set: vi.fn(),
      where: vi.fn(),
      returning: vi.fn(),
      execute: vi.fn(),
    };

    Object.values(queryBuilder).forEach((method) => {
      method.mockReturnValue(queryBuilder);
    });

    repository = {
      create: vi.fn((data: object) => ({ ...data })),
      save: vi.fn(async (data: object) => ({ id: 'insumo-1', ...data })),
      createQueryBuilder: vi.fn(() => queryBuilder),
    };

    service = new InventoryService(repository as never);
  });

  describe('crear', () => {
    it('crea el insumo con stock 0 y valores por defecto', async () => {
      await expect(
        service.crear({ nombre: '  Ibuprofeno 400mg ', unidadMedida: ' comprimido ' }),
      ).resolves.toEqual({
        id: 'insumo-1',
        nombre: 'Ibuprofeno 400mg',
        unidadMedida: 'comprimido',
        cantidadDisponible: 0,
        precioPesos: 0,
        stockMinimo: 0,
      });
    });

    it('respeta precio y stock minimo indicados', async () => {
      const resultado = await service.crear({
        nombre: 'Gasa',
        unidadMedida: 'unidad',
        precioPesos: 250,
        stockMinimo: 20,
      });

      expect(resultado.precioPesos).toBe(250);
      expect(resultado.stockMinimo).toBe(20);
    });

    it('devuelve 409 cuando el nombre ya existe', async () => {
      repository.save.mockRejectedValue(
        new QueryFailedError('INSERT', [], { code: '23505' } as never),
      );

      await expect(
        service.crear({ nombre: 'Gasa', unidadMedida: 'unidad' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('propaga errores de base de datos que no son de unicidad', async () => {
      const error = new Error('conexion perdida');
      repository.save.mockRejectedValue(error);

      await expect(
        service.crear({ nombre: 'Gasa', unidadMedida: 'unidad' }),
      ).rejects.toBe(error);
    });
  });

  describe('actualizar', () => {
    it('actualiza solo los campos enviados sin tocar el stock', async () => {
      queryBuilder.execute.mockResolvedValue({ affected: 1, raw: [rawInsumo] });

      await expect(
        service.actualizar('insumo-1', { precioPesos: 300, unidadMedida: 'caja' }),
      ).resolves.toEqual({
        id: 'insumo-1',
        nombre: 'Gasa',
        unidadMedida: 'caja',
        cantidadDisponible: 8,
        precioPesos: 300,
        stockMinimo: 5,
      });
      expect(queryBuilder.set).toHaveBeenCalledWith({
        precioPesos: 300,
        unidadMedida: 'caja',
      });
    });

    it('acepta precio y stock minimo en cero', async () => {
      queryBuilder.execute.mockResolvedValue({
        affected: 1,
        raw: [{ ...rawInsumo, precio_pesos: 0, stock_minimo: 0 }],
      });

      await service.actualizar('insumo-1', { precioPesos: 0, stockMinimo: 0 });

      expect(queryBuilder.set).toHaveBeenCalledWith({
        precioPesos: 0,
        stockMinimo: 0,
      });
    });

    it('devuelve 400 cuando no se indica ningun campo', async () => {
      await expect(
        service.actualizar('insumo-1', {}),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('devuelve 404 cuando el insumo no existe', async () => {
      queryBuilder.execute.mockResolvedValue({ affected: 0, raw: [] });

      await expect(
        service.actualizar('inexistente', { precioPesos: 10 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
