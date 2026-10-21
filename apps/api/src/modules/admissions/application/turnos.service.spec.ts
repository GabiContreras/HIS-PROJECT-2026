import { describe, it, expect, vi } from 'vitest';
import {
  EstadoCuenta,
  RolUsuario,
  Usuario,
} from '../../../entities/usuario.entity.js';
import { Paciente } from '../../../entities/paciente.entity.js';
import { EstadoTurno, Turno } from '../../../entities/turno.entity.js';
import { TurnosService } from './turnos.service.js';
import { ConflictException } from '@nestjs/common';

describe('TurnosService', () => {
  it('shortens the adjacent available slot atomically before creating a 15-minute urgent slot', async () => {
    const medico = {
      id: 'doctor-1',
      nombre: 'Ada',
      apellido: 'Lovelace',
      rol: RolUsuario.MEDICO,
      estado: EstadoCuenta.ACTIVO,
    } as Usuario;
    const adyacente = {
      id: 'slot-1',
      fechaHora: new Date('2030-01-01T09:00:00.000Z'),
      duracionMinutos: 30,
      estado: EstadoTurno.DISPONIBLE,
      urgente: false,
      medico,
    } as Turno;
    const query = {
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getCount: vi.fn().mockResolvedValue(0),
    };
    const turnoRepository = {
      findOne: vi.fn().mockResolvedValue(adyacente),
      createQueryBuilder: vi.fn().mockReturnValue(query),
      create: vi.fn((value) => ({ ...value, id: 'urgent-1' })),
      save: vi.fn(async (value) => value),
    };
    const usuarioRepository = { findOne: vi.fn().mockResolvedValue(medico) };
    const manager = {
      getRepository: vi.fn((entity) =>
        entity === Usuario ? usuarioRepository : turnoRepository,
      ),
    };
    const dataSource = {
      transaction: vi.fn((operation) => operation(manager)),
    };
    const service = new TurnosService(
      turnoRepository as never,
      {} as never,
      {} as never,
      dataSource as never,
    );

    const created = await service.createUrgentSlot(
      {
        medicoId: medico.id,
        fechaHora: '2030-01-01T09:15:00.000Z',
      },
      {
        accountId: medico.id,
        sessionId: 'session-1',
        rol: RolUsuario.MEDICO,
        esSuperadmin: false,
      },
    );

    expect(dataSource.transaction).toHaveBeenCalledOnce();
    expect(usuarioRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(turnoRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(adyacente.duracionMinutos).toBe(15);
    expect(created).toMatchObject({
      id: 'urgent-1',
      duracionMinutos: 15,
      urgente: true,
      estado: EstadoTurno.DISPONIBLE,
    });
  });

  it('locks the physician and slot inside the reservation transaction', async () => {
    const medico = {
      id: 'doctor-1',
      nombre: 'Ada',
      apellido: 'Lovelace',
      rol: RolUsuario.MEDICO,
      estado: EstadoCuenta.ACTIVO,
    } as Usuario;
    const paciente = {
      id: 'patient-1',
      nombre: 'Grace',
      apellido: 'Hopper',
    } as Paciente;
    const turno = {
      id: 'slot-1',
      fechaHora: new Date('2030-01-01T09:00:00.000Z'),
      duracionMinutos: 30,
      estado: EstadoTurno.DISPONIBLE,
      urgente: false,
      medico,
    } as Turno;
    const query = {
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getCount: vi.fn().mockResolvedValue(0),
    };
    const turnoRepository = {
      findOne: vi
        .fn()
        .mockResolvedValueOnce(turno)
        .mockResolvedValueOnce(turno)
        .mockResolvedValueOnce(turno),
      createQueryBuilder: vi.fn().mockReturnValue(query),
      save: vi.fn(async (value) => value),
    };
    const usuarioRepository = { findOne: vi.fn().mockResolvedValue(medico) };
    const pacienteRepository = { findOne: vi.fn().mockResolvedValue(paciente) };
    const manager = {
      getRepository: vi.fn((entity) => {
        if (entity === Usuario) return usuarioRepository;
        if (entity === Paciente) return pacienteRepository;
        return turnoRepository;
      }),
    };
    const dataSource = {
      transaction: vi.fn((operation) => operation(manager)),
    };
    const service = new TurnosService(
      turnoRepository as never,
      usuarioRepository as never,
      pacienteRepository as never,
      dataSource as never,
    );

    const reserved = await service.reserve(
      turno.id,
      { pacienteId: paciente.id },
      {
        accountId: medico.id,
        sessionId: 'session-1',
        rol: RolUsuario.MEDICO,
        esSuperadmin: false,
      },
    );

    expect(dataSource.transaction).toHaveBeenCalledOnce();
    expect(usuarioRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(turnoRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true },
        lock: { mode: 'pessimistic_write' },
      }),
    );
    expect(pacienteRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(reserved.estado).toBe(EstadoTurno.RESERVADO);
  });
  it('permite confirmar un turno reservado', async () => {
    const medico = {
      id: 'doctor-1',
      nombre: 'Ada',
      apellido: 'Lovelace',
      rol: RolUsuario.MEDICO,
      estado: EstadoCuenta.ACTIVO,
    } as Usuario;

    const turno = {
      id: 'slot-1',
      fechaHora: new Date('2030-01-01T09:00:00.000Z'),
      duracionMinutos: 30,
      estado: EstadoTurno.RESERVADO,
      urgente: false,
      medico,
    } as Turno;

    const turnoRepository = {
      findOne: vi.fn()
        .mockResolvedValueOnce(turno)
        .mockResolvedValueOnce(turno)
        .mockResolvedValueOnce(turno),
      save: vi.fn(async (value) => value),
      create: vi.fn((value) => value),
    };

    const usuarioRepository = {
      findOne: vi.fn().mockResolvedValue(medico),
    };

    const manager = {
      getRepository: vi.fn((entity) =>
        entity === Usuario ? usuarioRepository : turnoRepository,
      ),
    };

    const dataSource = {
      transaction: vi.fn((operation) => operation(manager)),
    };

    const service = new TurnosService(
      turnoRepository as never,
      usuarioRepository as never,
      {} as never,
      dataSource as never,
    );

    const resultado = await service.transition(
      turno.id,
      EstadoTurno.CONFIRMADO,
      {
        accountId: medico.id,
        sessionId: 'session-1',
        rol: RolUsuario.MEDICO,
        esSuperadmin: false,
      },
    );

    expect(resultado.estado).toBe(EstadoTurno.CONFIRMADO);
    expect(turnoRepository.save).toHaveBeenCalledOnce();
  });

  it('rechaza confirmar directamente un turno disponible', async () => {
    const medico = {
      id: 'doctor-1',
      nombre: 'Ada',
      apellido: 'Lovelace',
      rol: RolUsuario.MEDICO,
      estado: EstadoCuenta.ACTIVO,
    } as Usuario;

    const turno = {
      id: 'slot-1',
      fechaHora: new Date('2030-01-01T09:00:00.000Z'),
      duracionMinutos: 30,
      estado: EstadoTurno.DISPONIBLE,
      urgente: false,
      medico,
    } as Turno;

    const turnoRepository = {
      findOne: vi.fn()
        .mockResolvedValueOnce(turno)
        .mockResolvedValueOnce(turno)
        .mockResolvedValueOnce(turno),
      save: vi.fn(),
      create: vi.fn(),
    };

    const usuarioRepository = {
      findOne: vi.fn().mockResolvedValue(medico),
    };

    const manager = {
      getRepository: vi.fn((entity) =>
        entity === Usuario ? usuarioRepository : turnoRepository,
      ),
    };

    const dataSource = {
      transaction: vi.fn((operation) => operation(manager)),
    };

    const service = new TurnosService(
      turnoRepository as never,
      usuarioRepository as never,
      {} as never,
      dataSource as never,
    );

    await expect(
      service.transition(
        turno.id,
        EstadoTurno.CONFIRMADO,
        {
          accountId: medico.id,
          sessionId: 'session-1',
          rol: RolUsuario.MEDICO,
          esSuperadmin: false,
        },
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(turnoRepository.save).not.toHaveBeenCalled();
  });

  });
