
import { describe, it, expect, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { PacientesService } from './pacientes.service.js';
import { DocumentoDuplicadoError } from '../domain/documento-duplicado.error.js';

describe('PacientesService', () => {
  const dto = {
    nombre: 'Ada',
    apellido: 'Lovelace',
    documento: '12345678',
    fechaNacimiento: '1990-12-10',
    telefono: '1112345678',
  };

  it('registra un paciente cuando el documento no existe', async () => {
    const paciente = { id: 'patient-1', ...dto };

    const repository = {
      buscarPorDocumento: vi.fn().mockResolvedValue(null),
      guardar: vi.fn().mockResolvedValue(paciente),
    };

    const service = new PacientesService(repository);

    const resultado = await service.create(dto);

    expect(repository.buscarPorDocumento).toHaveBeenCalledWith(dto.documento);
    expect(repository.guardar).toHaveBeenCalledOnce();
    expect(resultado).toEqual(paciente);
  });

  it('rechaza un documento que ya está registrado', async () => {
    const repository = {
      buscarPorDocumento: vi.fn().mockResolvedValue({ id: 'patient-1' }),
      guardar: vi.fn(),
    };

    const service = new PacientesService(repository);

    await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
    expect(repository.guardar).not.toHaveBeenCalled();
  });

  it('convierte un error de documento duplicado en conflicto', async () => {
  const repository = {
    buscarPorDocumento: vi.fn().mockResolvedValue(null),
    guardar: vi
      .fn()
      .mockRejectedValue(new DocumentoDuplicadoError()),
  };

  const service = new PacientesService(repository);

  await expect(service.create(dto)).rejects.toBeInstanceOf(
    ConflictException,
  );
  });

  it('propaga los errores inesperados del repositorio', async () => {
    const error = new Error('Error inesperado de la base de datos');

    const repository = {
      buscarPorDocumento: vi.fn().mockResolvedValue(null),
      guardar: vi.fn().mockRejectedValue(error),
    };

    const service = new PacientesService(repository);

    await expect(service.create(dto)).rejects.toBe(error);
  });

});
