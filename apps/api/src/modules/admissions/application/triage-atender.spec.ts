import { ConflictException, NotFoundException } from '@nestjs/common';
import { EstadoTriaje } from '../../../entities/triaje.entity.js';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { TriageService } from './triage.service.js';

const medico = {
  accountId: 'doc-1',
  sessionId: 's1',
  rol: RolUsuario.MEDICO,
  esSuperadmin: false,
};

const enCola = () => ({
  id: 't-1',
  pacienteId: 'p-1',
  paciente: { apellido: 'Lovelace', nombre: 'Ada' },
  nivel: 'ROJO',
  motivoConsulta: 'Dolor precordial',
  estado: EstadoTriaje.EN_COLA,
  llegadaAt: new Date('2030-01-01T10:00:00Z'),
});

function build(registro: object | null) {
  const triajeRepo = {
    findOne: vi.fn().mockResolvedValue(registro),
    save: vi.fn(async (value) => value),
  };
  const dataSource = {
    transaction: vi.fn((operation) =>
      operation({ getRepository: () => triajeRepo }),
    ),
  };
  const turnos = {
    createUrgentAttendance: vi.fn().mockResolvedValue({ id: 'turno-1' }),
    publishAttended: vi.fn(),
  };
  const service = new TriageService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    dataSource as never,
    turnos as never,
  );
  return { service, triajeRepo, turnos };
}

describe('TriageService.atender (ADM-8)', () => {
  it('registra el turno urgente, marca el triaje y publica la atención', async () => {
    const { service, triajeRepo, turnos } = build(enCola());

    const result = await service.atender('t-1', medico);

    expect(turnos.createUrgentAttendance).toHaveBeenCalledWith(
      expect.anything(),
      'doc-1',
      'p-1',
    );
    expect(triajeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ estado: EstadoTriaje.ATENDIDO }),
    );
    expect(turnos.publishAttended).toHaveBeenCalledWith('turno-1', true);
    expect(result).toMatchObject({
      id: 't-1',
      turnoId: 'turno-1',
      estado: EstadoTriaje.ATENDIDO,
      paciente: 'Lovelace, Ada',
    });
  });

  it('responde 404 si el triaje no existe', async () => {
    const { service, turnos } = build(null);

    await expect(service.atender('t-1', medico)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(turnos.createUrgentAttendance).not.toHaveBeenCalled();
  });

  it('responde 409 si ya fue atendido y no genera otro cargo', async () => {
    const { service, turnos } = build({
      ...enCola(),
      estado: EstadoTriaje.ATENDIDO,
    });

    await expect(service.atender('t-1', medico)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(turnos.createUrgentAttendance).not.toHaveBeenCalled();
    expect(turnos.publishAttended).not.toHaveBeenCalled();
  });

  it('si no se puede crear el turno, no guarda el triaje ni publica', async () => {
    const { service, triajeRepo, turnos } = build(enCola());
    turnos.createUrgentAttendance.mockRejectedValueOnce(
      new ConflictException('sin hueco'),
    );

    await expect(service.atender('t-1', medico)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(triajeRepo.save).not.toHaveBeenCalled();
    expect(turnos.publishAttended).not.toHaveBeenCalled();
  });
});