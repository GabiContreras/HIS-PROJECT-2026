import {
  EstadoCuenta,
  RolUsuario,
  Usuario,
} from '../../../entities/usuario.entity.js';
import { Paciente } from '../../../entities/paciente.entity.js';
import { EstadoTurno, Turno } from '../../../entities/turno.entity.js';
import { TurnosService } from './turnos.service.js';

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
      {} as never,
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
      {} as never,
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
    expect(turnoRepository.findOne).toHaveBeenLastCalledWith(
      expect.objectContaining({
        lock: { mode: 'pessimistic_write', tables: ['turnos'] },
      }),
    );
    expect(pacienteRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(reserved.estado).toBe(EstadoTurno.RESERVADO);
  });

  it('publishes appointment attendance only after the transaction completes', async () => {
    const medico = {
      id: 'doctor-1',
      rol: RolUsuario.MEDICO,
      estado: EstadoCuenta.ACTIVO,
    } as Usuario;
    const turno = {
      id: 'appointment-1',
      estado: EstadoTurno.CONFIRMADO,
      urgente: true,
      fechaHora: new Date('2030-01-01T09:00:00.000Z'),
      duracionMinutos: 15,
      medico,
    } as Turno;
    const turnoRepository = {
      findOne: vi
        .fn()
        .mockResolvedValueOnce(turno)
        .mockResolvedValueOnce(turno),
      save: vi.fn(async (value) => value),
    };
    const usuarioRepository = { findOne: vi.fn().mockResolvedValue(medico) };
    const manager = {
      getRepository: vi.fn((entity) =>
        entity === Usuario ? usuarioRepository : turnoRepository,
      ),
    };
    const dataSource = {
      transaction: vi.fn(async (operation) => operation(manager)),
    };
    const events = { publish: vi.fn() };
    const service = new TurnosService(
      turnoRepository as never,
      usuarioRepository as never,
      {} as never,
      dataSource as never,
      events as never,
    );

    const result = await service.transition(
      turno.id,
      EstadoTurno.ATENDIDO,
      {
        accountId: medico.id,
        sessionId: 'session-1',
        rol: RolUsuario.MEDICO,
        esSuperadmin: false,
      },
    );

    expect(result.estado).toBe(EstadoTurno.ATENDIDO);
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'admissions.appointment-attended',
        payload: { appointmentId: turno.id, urgente: true },
      }),
    );
    expect(dataSource.transaction.mock.invocationCallOrder[0]).toBeLessThan(
      events.publish.mock.invocationCallOrder[0],
    );
  });

  describe('reservation conflicts', () => {
    const admin = {
      accountId: 'admin-1',
      sessionId: 'session-1',
      rol: RolUsuario.ADMINISTRATIVO,
      esSuperadmin: false,
    };

    function serviceWithSlot(slot: Partial<Turno>) {
      const medico = {
        id: 'doctor-1',
        rol: RolUsuario.MEDICO,
        estado: EstadoCuenta.ACTIVO,
      } as Usuario;
      const turno = { id: 'slot-1', medico, ...slot } as Turno;
      const turnoRepository = {
        findOne: vi
          .fn()
          .mockResolvedValueOnce(turno)
          .mockResolvedValueOnce(turno),
      };
      const usuarioRepository = { findOne: vi.fn().mockResolvedValue(medico) };
      const pacienteRepository = { findOne: vi.fn() };
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
      return new TurnosService(
        turnoRepository as never,
        usuarioRepository as never,
        pacienteRepository as never,
        dataSource as never,
        {} as never,
      );
    }

    it('tells the second receptionist that the slot was just taken', async () => {
      const service = serviceWithSlot({
        fechaHora: new Date('2030-01-01T13:00:00.000Z'),
        estado: EstadoTurno.RESERVADO,
      });

      await expect(
        service.reserve('slot-1', { pacienteId: 'patient-2' }, admin),
      ).rejects.toThrow('Este turno acaba de ser ocupado. Elegí otro horario.');
    });

    it('does not say "taken" when the slot is simply in the past', async () => {
      const service = serviceWithSlot({
        fechaHora: new Date('2020-01-01T13:00:00.000Z'),
        estado: EstadoTurno.DISPONIBLE,
      });

      await expect(
        service.reserve('slot-1', { pacienteId: 'patient-2' }, admin),
      ).rejects.toThrow('Este turno ya pasó. Elegí otro horario.');
    });
  });

  describe('regular slot hours (08:00 to 20:00, Argentina time)', () => {
    const admin = {
      accountId: 'admin-1',
      sessionId: 'session-1',
      rol: RolUsuario.ADMINISTRATIVO,
      esSuperadmin: false,
    };

    // La transacción falla a propósito: si el error es este, la validación de horario ya pasó.
    function service() {
      const dataSource = {
        transaction: vi.fn().mockRejectedValue(new Error('reached-database')),
      };
      return new TurnosService(
        {} as never,
        {} as never,
        {} as never,
        dataSource as never,
        {} as never,
      );
    }

    it.each([
      ['07:30', '2030-01-01T10:30:00.000Z'],
      ['20:00', '2030-01-01T23:00:00.000Z'],
      ['03:00', '2030-01-01T06:00:00.000Z'],
    ])('rejects a regular slot at %s', async (_label, fechaHora) => {
      await expect(
        service().createSlot({ medicoId: 'doctor-1', fechaHora }, admin),
      ).rejects.toThrow('Los turnos regulares se atienden de 08:00 a 20:00.');
    });

    it.each([
      ['08:00', '2030-01-01T11:00:00.000Z'],
      ['19:30', '2030-01-01T22:30:00.000Z'],
    ])('accepts a regular slot at %s', async (_label, fechaHora) => {
      await expect(
        service().createSlot({ medicoId: 'doctor-1', fechaHora }, admin),
      ).rejects.toThrow('reached-database');
    });

    it('does not restrict urgent slots to clinic hours', async () => {
      // 03:15 hora de Argentina: pasa la validación de horario y recién falla al buscar el turno vecino.
      await expect(
        service().createUrgentSlot(
          { medicoId: 'doctor-1', fechaHora: '2030-01-01T06:15:00.000Z' },
          admin,
        ),
      ).rejects.toThrow('reached-database');
    });
  });
});
