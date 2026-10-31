import { ConflictException, ForbiddenException } from '@nestjs/common';
import { EntreturnoStandby } from '../../../entities/entreturno-standby.entity.js';
import { RolUsuario, Usuario } from '../../../entities/usuario.entity.js';
import { EntreturnoStandbyService } from './entreturno-standby.service.js';

const medico = { id: 'doctor-1', nombre: 'Ada', apellido: 'Lovelace' } as Usuario;
const paciente = { id: 'patient-1', nombre: 'Luis', apellido: 'Medina' };
const admin = { accountId: 'a', sessionId: 's', rol: RolUsuario.ADMINISTRATIVO, esSuperadmin: false };

function setup(opts: { libres?: unknown[]; position?: number } = {}) {
  const standbyRepository = {
    create: vi.fn((v) => ({ ...v, id: 'w-1', createdAt: new Date() })),
    save: vi.fn(async (v) => v),
    count: vi.fn().mockResolvedValue(opts.position ?? 1),
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn(),
  };
  const pacientes = { findOne: vi.fn().mockResolvedValue(paciente) };
  const turnos = {
    assertCanManageDoctor: vi.fn(),
    lockDoctor: vi.fn().mockResolvedValue(medico),
    listAvailable: vi.fn().mockResolvedValue(opts.libres ?? []),
  };
  const manager = { getRepository: vi.fn(() => standbyRepository) };
  const dataSource = { transaction: vi.fn((op) => op(manager)) };
  const service = new EntreturnoStandbyService(
    standbyRepository as never,
    pacientes as never,
    turnos as never,
    dataSource as never,
  );
  return { service, standbyRepository, turnos };
}

describe('EntreturnoStandbyService (HU 1.3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T12:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  const dto = { medicoId: 'doctor-1', pacienteId: 'patient-1', fecha: '2030-01-01' };

  it('anota al paciente cuando la agenda del día está completa', async () => {
    const { service, turnos } = setup({ position: 2 });
    const entry = await service.join(dto, admin);
    expect(entry).toMatchObject({ posicion: 2, fecha: '2030-01-01' });
    expect(entry.paciente.apellido).toBe('Medina');
    // Chequea disponibilidad del día completo de la clínica (00:00–24:00 -03:00).
    expect(turnos.listAvailable).toHaveBeenCalledWith(
      'doctor-1',
      '2030-01-01T03:00:00.000Z',
      '2030-01-02T03:00:00.000Z',
    );
  });

  it('rechaza si el médico todavía tiene horarios libres', async () => {
    const { service } = setup({ libres: [{}] });
    await expect(service.join(dto, admin)).rejects.toThrow('todavía tiene horarios libres');
  });

  it('rechaza días que ya pasaron', async () => {
    const { service } = setup();
    await expect(service.join({ ...dto, fecha: '2029-12-30' }, admin)).rejects.toThrow('ya pasó');
  });

  it('traduce el índice único a "ya está en la lista de espera"', async () => {
    const { service, standbyRepository } = setup();
    standbyRepository.save.mockRejectedValueOnce({ code: '23505' });
    await expect(service.join(dto, admin)).rejects.toThrow(ConflictException);
  });

  it('numera la cola por médico en orden de llegada', async () => {
    const { service, standbyRepository } = setup();
    const row = (id: string, medicoId: string) => ({
      id,
      fecha: '2030-01-01',
      createdAt: new Date(),
      medico: { id: medicoId, nombre: 'X', apellido: medicoId },
      paciente,
    });
    standbyRepository.find.mockResolvedValue([row('1', 'a'), row('2', 'a'), row('3', 'b')]);
    const list = await service.list({}, admin);
    expect(list.map((e) => [e.id, e.posicion])).toEqual([['1', 1], ['2', 2], ['3', 1]]);
  });

  it('un médico no puede ver la lista de otro', async () => {
    const { service } = setup();
    const doctor = { ...admin, accountId: 'doctor-1', rol: RolUsuario.MEDICO };
    await expect(service.list({ medicoId: 'doctor-2' }, doctor)).rejects.toThrow(ForbiddenException);
  });

  it('retirar de la cola marca la espera como RETIRADO', async () => {
    const { service, standbyRepository } = setup();
    standbyRepository.findOne.mockResolvedValue({ id: 'w-1', estado: 'EN_COLA', medico });
    await service.leave('w-1', admin);
    expect(standbyRepository.save).toHaveBeenCalledWith(expect.objectContaining({ estado: 'RETIRADO' }));
  });
});
