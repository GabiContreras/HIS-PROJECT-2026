
import { describe, it, expect, vi } from 'vitest';
import { QueryFailedError } from 'typeorm';
import { TypeOrmPacientesRepository } from './typeorm-pacientes.repository.js';
import { DocumentoDuplicadoError } from '../domain/documento-duplicado.error.js';
import type { Paciente } from '../domain/paciente.js';

describe('TypeOrmPacientesRepository', () => {
  const paciente: Paciente = {
    id: 'patient-1',
    nombre: 'Ada',
    apellido: 'Lovelace',
    documento: '12345678',
    fechaNacimiento: '1990-12-10',
    telefono: '1112345678',
  };

  function crearRepositorio() {
    const entidad = { ...paciente };

    const repository = {
      findOne: vi.fn(),
      create: vi.fn((datos) => datos),
      save: vi.fn(),
    };

    const adapter = new TypeOrmPacientesRepository(
      repository as never,
    );

    return { adapter, repository, entidad };
  }

  it('devuelve null cuando el paciente no existe', async () => {
    const { adapter, repository } = crearRepositorio();
    repository.findOne.mockResolvedValue(null);

    const resultado = await adapter.buscarPorDocumento(paciente.documento);

    expect(resultado).toBeNull();
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { documento: paciente.documento },
    });
  });

  it('convierte la entidad encontrada al modelo de dominio', async () => {
    const { adapter, repository, entidad } = crearRepositorio();
    repository.findOne.mockResolvedValue(entidad);

    const resultado = await adapter.buscarPorDocumento(paciente.documento);

    expect(resultado).toEqual(paciente);
  });

  it('guarda el paciente y devuelve el resultado', async () => {
    const { adapter, repository } = crearRepositorio();
    repository.save.mockResolvedValue(paciente);

    const resultado = await adapter.guardar(paciente);

    expect(repository.create).toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledOnce();
    expect(resultado).toEqual(paciente);
  });

  it('convierte la restricción de documento duplicado en un error de dominio', async () => {
    const { adapter, repository } = crearRepositorio();

    const errorPostgres = Object.assign(
      new Error('duplicate key'),
      {
        code: '23505',
        constraint: 'uq_pacientes_documento',
      },
    );

    repository.save.mockRejectedValue(
      new QueryFailedError(
        'INSERT INTO pacientes',
        [],
        errorPostgres,
      ),
    );

    await expect(adapter.guardar(paciente)).rejects.toBeInstanceOf(
      DocumentoDuplicadoError,
    );
  });

  it('propaga los errores que no corresponden al documento duplicado', async () => {
    const { adapter, repository } = crearRepositorio();
    const error = new Error('Error inesperado');

    repository.save.mockRejectedValue(error);

    await expect(adapter.guardar(paciente)).rejects.toBe(error);
  });
});
