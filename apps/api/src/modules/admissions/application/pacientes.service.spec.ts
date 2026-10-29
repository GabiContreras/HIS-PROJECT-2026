import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DocumentoDuplicadoError } from '../domain/ports/pacientes.repository.js';
import { PacientesService } from './pacientes.service.js';

const input = {
  nombre: 'Marta',
  apellido: 'Pérez',
  documento: '20111222',
  fechaNacimiento: '1958-03-12',
  telefono: '3511234567',
};

function makeRepository(overrides: Record<string, unknown> = {}) {
  return {
    search: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    findByDocumento: vi.fn().mockResolvedValue(null),
    create: vi.fn(async (data) => ({ id: 'p-1', ...data })),
    ...overrides,
  };
}

const makeService = (repo: ReturnType<typeof makeRepository>) =>
  new PacientesService(repo as never);

describe('PacientesService', () => {
  it('crea un paciente nuevo', async () => {
    const repo = makeRepository();

    const created = await makeService(repo).create(input, '2026-10-27');

    expect(repo.create).toHaveBeenCalledOnce();
    expect(created).toMatchObject({ id: 'p-1', documento: '20111222' });
  });

  it('rechaza un documento ya registrado sin guardar', async () => {
    const repo = makeRepository({
      findByDocumento: vi.fn().mockResolvedValue({ id: 'x' }),
    });

    await expect(
      makeService(repo).create(input, '2026-10-27'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('traduce el duplicado detectado al guardar (alta simultánea) a 409', async () => {
    const repo = makeRepository({
      create: vi.fn().mockRejectedValue(new DocumentoDuplicadoError()),
    });

    await expect(
      makeService(repo).create(input, '2026-10-27'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rechaza una fecha de nacimiento futura', async () => {
    const repo = makeRepository();

    await expect(
      makeService(repo).create(
        { ...input, fechaNacimiento: '2999-01-01' },
        '2026-10-27',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.findByDocumento).not.toHaveBeenCalled();
  });

  it('admite una persona de 115 años cumplidos', async () => {
    const repo = makeRepository();

    await makeService(repo).create(
      { ...input, fechaNacimiento: '1910-10-28' },
      '2026-10-27',
    );

    expect(repo.create).toHaveBeenCalledOnce();
  });

  it('rechaza una fecha de nacimiento que supera los 115 años', async () => {
    const repo = makeRepository();

    await expect(
      makeService(repo).create(
        { ...input, fechaNacimiento: '1910-10-27' },
        '2026-10-27',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.findByDocumento).not.toHaveBeenCalled();
  });

  it('informa 404 cuando el paciente no existe', async () => {
    await expect(
      makeService(makeRepository()).get('p-404'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
