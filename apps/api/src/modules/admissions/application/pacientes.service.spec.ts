import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PacientesService } from './pacientes.service.js';

const valid = {
  nombre: 'Marta',
  apellido: 'Pérez',
  documento: '20111222',
  fechaNacimiento: '1958-03-12',
  telefono: '3511234567',
};

function makeService(repo: Record<string, unknown>) {
  return new PacientesService(repo as never);
}

describe('PacientesService', () => {
  it('guarda un paciente nuevo con los datos normalizados', async () => {
    const repo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn((value) => value),
      save: vi.fn(async (value) => ({ id: 'p-1', ...value })),
    };

    const created = await makeService(repo).create(valid);

    expect(repo.save).toHaveBeenCalledOnce();
    expect(created).toMatchObject({ id: 'p-1', documento: '20111222' });
  });

  it('rechaza un documento ya registrado sin guardar', async () => {
    const repo = {
      findOne: vi.fn().mockResolvedValue({ id: 'p-1' }),
      create: vi.fn(),
      save: vi.fn(),
    };

    await expect(makeService(repo).create(valid)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rechaza una fecha de nacimiento futura', async () => {
    const repo = { findOne: vi.fn(), create: vi.fn(), save: vi.fn() };

    await expect(
      makeService(repo).create({ ...valid, fechaNacimiento: '2999-01-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.findOne).not.toHaveBeenCalled();
  });

  it('informa 404 cuando el paciente no existe', async () => {
    const repo = { findOne: vi.fn().mockResolvedValue(null) };

    await expect(makeService(repo).get('p-404')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});