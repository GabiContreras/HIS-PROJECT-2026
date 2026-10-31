import {
  EstadoCuenta,
  RolUsuario,
  Usuario,
} from '../../../entities/usuario.entity.js';
import { EstadoTurno, Turno } from '../../../entities/turno.entity.js';
import { EntreturnoStandby } from '../../../entities/entreturno-standby.entity.js';
import { Paciente } from '../../../entities/paciente.entity.js';
import { TurnosService } from './turnos.service.js';

// 2030-01-01 es martes. Argentina = UTC-3, así que 12:00Z = 09:00 locales.
const at = (utcTime: string) => new Date(`2030-01-01T${utcTime}:00.000Z`);

const medico = {
  id: 'doctor-1',
  nombre: 'Ada',
  apellido: 'Lovelace',
  rol: RolUsuario.MEDICO,
  estado: EstadoCuenta.ACTIVO,
  horaInicio: '08:00:00',
  horaFin: '16:00:00',
} as Usuario;

const admin = {
  accountId: 'admin-1',
  sessionId: 'session-1',
  rol: RolUsuario.ADMINISTRATIVO,
  esSuperadmin: false,
};

/** Arma un servicio con `overlapCounts` = resultados sucesivos de getCount(). */
function setup(overlapCounts: number[] = [], opts: { doctor?: Usuario } = {}) {
  const counts = [...overlapCounts];
  const query = {
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    getCount: vi.fn(async () => counts.shift() ?? 0),
  };
  const turnoRepository = {
    findOne: vi.fn(),
    createQueryBuilder: vi.fn().mockReturnValue(query),
    create: vi.fn((value) => ({ ...value, id: 'turno-1' })),
    save: vi.fn(async (value) => value),
  };
  const usuarioRepository = {
    findOne: vi.fn().mockResolvedValue(opts.doctor ?? medico),
    find: vi.fn().mockResolvedValue([opts.doctor ?? medico]),
  };
  const pacienteRepository = {
    findOne: vi.fn().mockResolvedValue({ id: 'patient-1' } as Paciente),
  };
  const standbyRepository = {
    find: vi.fn().mockResolvedValue([]),
    save: vi.fn(async (value) => value),
  };
  const manager = {
    getRepository: vi.fn((entity) =>
      entity === Usuario
        ? usuarioRepository
        : entity === Paciente
          ? pacienteRepository
          : entity === EntreturnoStandby
            ? standbyRepository
            : turnoRepository,
    ),
  };
  const dataSource = { transaction: vi.fn((op) => op(manager)) };
  const events = { publish: vi.fn() };
  const service = new TurnosService(
    turnoRepository as never,
    usuarioRepository as never,
    pacienteRepository as never,
    dataSource as never,
    events as never,
  );
  return { service, turnoRepository, usuarioRepository, standbyRepository, query, dataSource, events };
}

describe('TurnosService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2029-12-31T12:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  describe('reserve (HU 1.1)', () => {
    it('reserva el horario con lock del médico y queda RESERVADO', async () => {
      const { service, usuarioRepository, dataSource } = setup();
      const created = await service.reserve(
        { medicoId: 'doctor-1', fechaHora: at('12:00').toISOString(), pacienteId: 'patient-1' },
        admin,
      );
      expect(dataSource.transaction).toHaveBeenCalledOnce();
      expect(usuarioRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
      );
      expect(created).toMatchObject({
        estado: EstadoTurno.RESERVADO,
        duracionMinutos: 30,
        urgente: false,
      });
    });

    it('avisa a la segunda recepcionista que el turno acaba de ser ocupado', async () => {
      const { service } = setup([1]);
      await expect(
        service.reserve(
          { medicoId: 'doctor-1', fechaHora: at('12:00').toISOString(), pacienteId: 'patient-1' },
          admin,
        ),
      ).rejects.toThrow('acaba de ser ocupado');
    });

    it('traduce la violación del índice único a "acaba de ser ocupado"', async () => {
      const { service, turnoRepository } = setup();
      turnoRepository.save.mockRejectedValueOnce({ code: '23505' });
      await expect(
        service.reserve(
          { medicoId: 'doctor-1', fechaHora: at('12:00').toISOString(), pacienteId: 'patient-1' },
          admin,
        ),
      ).rejects.toThrow('acaba de ser ocupado');
    });

    it('rechaza horarios fuera de la jornada del médico (08–16)', async () => {
      const { service } = setup();
      // 19:00Z = 16:00 locales: el turno terminaría a las 16:30.
      await expect(
        service.reserve(
          { medicoId: 'doctor-1', fechaHora: at('19:00').toISOString(), pacienteId: 'patient-1' },
          admin,
        ),
      ).rejects.toThrow('atiende de 08:00 a 16:00');
    });

    it('si un entreturno ocupa la segunda mitad, el turno queda en 15 min', async () => {
      const { service } = setup([0, 1]);
      const created = await service.reserve(
        { medicoId: 'doctor-1', fechaHora: at('12:00').toISOString(), pacienteId: 'patient-1' },
        admin,
      );
      expect(created.duracionMinutos).toBe(15);
    });

    it('no dice "ocupado" cuando el horario simplemente ya pasó', async () => {
      const { service } = setup();
      vi.setSystemTime(new Date('2030-01-01T13:00:00.000Z'));
      await expect(
        service.reserve(
          { medicoId: 'doctor-1', fechaHora: at('12:00').toISOString(), pacienteId: 'patient-1' },
          admin,
        ),
      ).rejects.toThrow('ya pasó');
    });

    it('exige minutos :00 o :30', async () => {
      const { service } = setup();
      await expect(
        service.reserve(
          { medicoId: 'doctor-1', fechaHora: at('12:15').toISOString(), pacienteId: 'patient-1' },
          admin,
        ),
      ).rejects.toThrow('cada 30 minutos');
    });
  });

  describe('reserveUrgent (HU 1.2)', () => {
    it('crea un entreturno de 15 min sobre un horario libre de 30 min', async () => {
      const { service } = setup();
      const created = await service.reserveUrgent(
        { medicoId: 'doctor-1', fechaHora: at('12:15').toISOString(), pacienteId: 'patient-1' },
        admin,
      );
      expect(created).toMatchObject({
        duracionMinutos: 15,
        urgente: true,
        estado: EstadoTurno.RESERVADO,
      });
    });

    it('rechaza el entreturno si el horario adyacente no está libre', async () => {
      const { service } = setup([1]);
      await expect(
        service.reserveUrgent(
          { medicoId: 'doctor-1', fechaHora: at('12:15').toISOString(), pacienteId: 'patient-1' },
          admin,
        ),
      ).rejects.toThrow('turno disponible adyacente');
    });

    it('exige minutos :15 o :45', async () => {
      const { service } = setup();
      await expect(
        service.reserveUrgent(
          { medicoId: 'doctor-1', fechaHora: at('12:00').toISOString(), pacienteId: 'patient-1' },
          admin,
        ),
      ).rejects.toThrow(':15 o :45');
    });
  });

  describe('listAvailable', () => {
    it('calcula 16 horarios de 30 min para un médico de 08:00 a 16:00', async () => {
      const { service, turnoRepository } = setup();
      turnoRepository.createQueryBuilder.mockReturnValue({
        innerJoin: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([]),
      });
      const slots = await service.listAvailable(
        'doctor-1',
        at('11:00').toISOString(), // 08:00 locales
        at('23:00').toISOString(), // 20:00 locales
      );
      expect(slots).toHaveLength(16);
      expect(slots[0].fechaHora).toEqual(at('11:00'));
      expect(slots.at(-1)?.fechaHora).toEqual(at('18:30'));
    });

    it('descarta lo ocupado y acorta el horario previo a un entreturno', async () => {
      const { service, turnoRepository } = setup();
      turnoRepository.createQueryBuilder.mockReturnValue({
        innerJoin: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([
          // turno reservado 08:00 locales (30 min)
          { fechaHora: at('11:00'), duracionMinutos: 30, medico: { id: 'doctor-1' } },
          // entreturno 09:15 locales (15 min)
          { fechaHora: at('12:15'), duracionMinutos: 15, medico: { id: 'doctor-1' } },
        ]),
      });
      const slots = await service.listAvailable(
        'doctor-1',
        at('11:00').toISOString(),
        at('13:00').toISOString(),
      );
      // 08:00 ocupado; 08:30 libre 30; 09:00 libre pero acortado a 15
      expect(slots.map((s) => [s.fechaHora.toISOString(), s.duracionMinutos])).toEqual([
        [at('11:30').toISOString(), 30],
        [at('12:00').toISOString(), 15],
        [at('12:30').toISOString(), 30],
      ]);
    });

    it('rechaza rangos de más de 31 días', async () => {
      const { service } = setup();
      await expect(
        service.listAvailable(undefined, '2030-01-01T00:00:00Z', '2030-03-01T00:00:00Z'),
      ).rejects.toThrow('31 días');
    });
  });

  describe('transition (HU 2.1)', () => {
    const turno = (estado: EstadoTurno) =>
      ({
        id: 'turno-1',
        estado,
        urgente: false,
        fechaHora: at('12:00'),
        duracionMinutos: 30,
        medico,
        paciente: { id: 'patient-1' },
      }) as unknown as Turno;

    it('Confirmado → En Sala de Espera notifica al consultorio', async () => {
      const { service, turnoRepository, events } = setup();
      turnoRepository.findOne.mockResolvedValue(turno(EstadoTurno.CONFIRMADO));
      const result = await service.transition('turno-1', EstadoTurno.EN_SALA_DE_ESPERA, admin);
      expect(result.estado).toBe(EstadoTurno.EN_SALA_DE_ESPERA);
      expect(events.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'admissions.patient-waiting' }),
      );
    });

    it('bloquea Cancelado → Atendido con error de negocio y sin eventos', async () => {
      const { service, turnoRepository, events } = setup();
      turnoRepository.findOne.mockResolvedValue(turno(EstadoTurno.CANCELADO));
      await expect(
        service.transition('turno-1', EstadoTurno.ATENDIDO, admin),
      ).rejects.toThrow('Un turno cancelado no puede avanzar en el flujo de atención.');
      expect(events.publish).not.toHaveBeenCalled();
    });

    it('publica la atención solo cuando la transacción terminó', async () => {
      const { service, turnoRepository, dataSource, events } = setup();
      turnoRepository.findOne.mockResolvedValue(turno(EstadoTurno.EN_SALA_DE_ESPERA));
      dataSource.transaction.mockImplementationOnce(async (op) => {
        const result = await op({
          getRepository: (e: unknown) =>
            e === Usuario ? { findOne: async () => medico } : turnoRepository,
        });
        expect(events.publish).not.toHaveBeenCalled();
        return result;
      });
      await service.transition('turno-1', EstadoTurno.ATENDIDO, admin);
      expect(events.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'admissions.appointment-attended' }),
      );
    });

    it('cancelar ya no crea una fila libre nueva (la disponibilidad se calcula)', async () => {
      const { service, turnoRepository } = setup();
      turnoRepository.findOne.mockResolvedValue(turno(EstadoTurno.RESERVADO));
      await service.transition('turno-1', EstadoTurno.CANCELADO, admin);
      expect(turnoRepository.create).not.toHaveBeenCalled();
    });

    describe('lista de espera (HU 1.3)', () => {
      const cancelable = () =>
        ({
          id: 'turno-1',
          estado: EstadoTurno.RESERVADO,
          urgente: false,
          fechaHora: at('14:00'), // 11:00 locales
          duracionMinutos: 30,
          medico,
          paciente: { id: 'patient-1' },
        }) as unknown as Turno;
      const enCola = (id: string, apellido: string) => ({
        id: `w-${id}`,
        estado: 'EN_COLA',
        paciente: { id, nombre: 'Luis', apellido },
      });

      it('al cancelar, el primero de la cola recibe el horario liberado', async () => {
        const { service, turnoRepository, standbyRepository, events } = setup();
        turnoRepository.findOne.mockResolvedValue(cancelable());
        standbyRepository.find.mockResolvedValue([enCola('p2', 'Medina'), enCola('p3', 'Gómez')]);
        const result = await service.transition('turno-1', EstadoTurno.CANCELADO, admin);
        expect(result.estado).toBe(EstadoTurno.CANCELADO);
        expect(result.promovido?.paciente).toMatchObject({ id: 'p2', apellido: 'Medina' });
        expect(result.promovido?.turno).toMatchObject({
          estado: EstadoTurno.RESERVADO,
          duracionMinutos: 30,
        });
        expect(standbyRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({ estado: 'ASIGNADO' }),
        );
        expect(events.publish).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'admissions.standby-promoted' }),
        );
      });

      it('busca la cola del mismo médico y del mismo día del turno cancelado', async () => {
        const { service, turnoRepository, standbyRepository } = setup();
        turnoRepository.findOne.mockResolvedValue(cancelable());
        await service.transition('turno-1', EstadoTurno.CANCELADO, admin);
        expect(standbyRepository.find).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ fecha: '2030-01-01', estado: 'EN_COLA' }),
            order: { createdAt: 'ASC' },
          }),
        );
      });

      it('salta a quien ya tiene otro turno en ese horario', async () => {
        const { service, turnoRepository, standbyRepository } = setup([1, 0]);
        turnoRepository.findOne.mockResolvedValue(cancelable());
        standbyRepository.find.mockResolvedValue([enCola('p2', 'Medina'), enCola('p3', 'Gómez')]);
        const result = await service.transition('turno-1', EstadoTurno.CANCELADO, admin);
        expect(result.promovido?.paciente.id).toBe('p3');
      });

      it('sin cola no hay promoción', async () => {
        const { service, turnoRepository } = setup();
        turnoRepository.findOne.mockResolvedValue(cancelable());
        const result = await service.transition('turno-1', EstadoTurno.CANCELADO, admin);
        expect(result.promovido).toBeNull();
      });

      it('no promueve si el horario liberado ya pasó', async () => {
        const { service, turnoRepository, standbyRepository } = setup();
        turnoRepository.findOne.mockResolvedValue(cancelable());
        vi.setSystemTime(new Date('2030-01-01T15:00:00.000Z'));
        const result = await service.transition('turno-1', EstadoTurno.CANCELADO, admin);
        expect(result.promovido).toBeNull();
        expect(standbyRepository.find).not.toHaveBeenCalled();
      });

      it('otras transiciones no tocan la lista de espera', async () => {
        const { service, turnoRepository, standbyRepository } = setup();
        turnoRepository.findOne.mockResolvedValue({ ...cancelable(), estado: EstadoTurno.RESERVADO });
        await service.transition('turno-1', EstadoTurno.CONFIRMADO, admin);
        expect(standbyRepository.find).not.toHaveBeenCalled();
      });
    });
  });
});
