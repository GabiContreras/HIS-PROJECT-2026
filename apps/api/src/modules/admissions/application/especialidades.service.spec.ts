import { ConflictException, NotFoundException } from '@nestjs/common';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { EspecialidadesService } from './especialidades.service.js';

function build(opts: { medico?: object | null; found?: number; asignadas?: number } = {}) {
  const especialidades = {
    find: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(opts.found ?? 0),
    create: vi.fn((value) => value),
    save: vi.fn(async (value) => ({ id: 'e1', ...value })),
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
  };
  const asignaciones = {
    find: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(opts.asignadas ?? 0),
  };
  const usuarios = {
    findOneBy: vi
      .fn()
      .mockResolvedValue(
        opts.medico === undefined ? { id: 'm1', rol: RolUsuario.MEDICO } : opts.medico,
      ),
  };
  const repo = { delete: vi.fn(), insert: vi.fn() };
  const dataSource = {
    transaction: vi.fn((operation) => operation({ getRepository: () => repo })),
  };
  const service = new EspecialidadesService(
    especialidades as never,
    asignaciones as never,
    usuarios as never,
    dataSource as never,
  );
  return { service, especialidades, asignaciones, repo };
}

describe('EspecialidadesService', () => {
  it('reemplaza las especialidades del médico sin duplicados', async () => {
    const { service, repo } = build({ found: 2 });
    await service.asignar('m1', ['e1', 'e2', 'e1']);
    expect(repo.delete).toHaveBeenCalledWith({ medicoId: 'm1' });
    expect(repo.insert).toHaveBeenCalledWith([
      { medicoId: 'm1', especialidadId: 'e1' },
      { medicoId: 'm1', especialidadId: 'e2' },
    ]);
  });

  it('con lista vacía solo borra las asignaciones', async () => {
    const { service, repo } = build();
    await service.asignar('m1', []);
    expect(repo.delete).toHaveBeenCalled();
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('rechaza una especialidad que no existe', async () => {
    const { service, repo } = build({ found: 1 });
    await expect(service.asignar('m1', ['e1', 'e2'])).rejects.toThrow('no existe');
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('solo los médicos tienen especialidades', async () => {
    const { service } = build({ medico: { id: 'n1', rol: RolUsuario.ENFERMERO } });
    await expect(service.asignar('n1', [])).rejects.toBeInstanceOf(NotFoundException);
  });

  it('responde 409 si el nombre ya existe', async () => {
    const { service, especialidades } = build();
    especialidades.save.mockRejectedValueOnce({ code: '23505' });
    await expect(service.create('Cardiología')).rejects.toBeInstanceOf(ConflictException);
  });

  it('no elimina una especialidad asignada a médicos', async () => {
    const { service, especialidades } = build({ asignadas: 2 });
    await expect(service.remove('e1')).rejects.toBeInstanceOf(ConflictException);
    expect(especialidades.delete).not.toHaveBeenCalled();
  });

  it('devuelve los ids de médicos de una especialidad', async () => {
    const { service, asignaciones } = build();
    asignaciones.find.mockResolvedValue([{ medicoId: 'm1' }, { medicoId: 'm2' }]);
    await expect(service.medicoIds('e1')).resolves.toEqual(['m1', 'm2']);
  });
});