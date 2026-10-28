import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { INTEGRATION_EVENTS } from '../../../shared/events/integration-event-names.js';
import type { SessionIdentity } from '../../iam/application/auth.service.js';
import type {
  AdministracionData,
  ContextoAdministracion,
  IndicacionData,
  NuevaAdministracion,
} from '../domain/ports/indicaciones.repository.js';
import { IndicacionesService } from './indicaciones.service.js';

describe('IndicacionesService', () => {
  const nurse: SessionIdentity = { accountId: 'nurse-1', sessionId: 's1', rol: RolUsuario.ENFERMERO, esSuperadmin: false };
  const doctor: SessionIdentity = { accountId: 'doc-1', sessionId: 's2', rol: RolUsuario.MEDICO, esSuperadmin: false };

  const inicio = new Date('2030-01-01T06:00:00.000Z'); // dosis 06:00, 14:00, 22:00
  const indicacion: IndicacionData = {
    id: 'ind-1',
    pacienteId: 'patient-1',
    paciente: 'Rojas, Ana',
    medicoId: 'doc-1',
    insumoId: 'supply-1',
    insumo: 'Ibuprofeno',
    dosis: '400 mg',
    frecuencia: 'cada 8 horas',
    frecuenciaHoras: 8,
    fechaInicio: inicio,
    fechaFin: null,
  };

  function admin(fecha: string): AdministracionData {
    return {
      id: 'adm-0',
      indicacionId: 'ind-1',
      enfermeroId: 'nurse-9',
      enfermero: 'Pérez, Juan',
      fechaHoraAdministracion: new Date(fecha),
      observaciones: null,
    };
  }

  function build(options: { ind?: IndicacionData | null; previas?: AdministracionData[]; insumoExiste?: boolean; pacienteExiste?: boolean } = {}) {
    const ind = options.ind === undefined ? indicacion : options.ind;
    const repository = {
      insumoExiste: vi.fn(async () => options.insumoExiste !== false),
      create: vi.fn(async (data: Record<string, unknown>) => ({
        ...indicacion,
        pacienteId: data.pacienteId as string,
        medicoId: data.medicoId as string,
        frecuencia: data.frecuencia as string,
        frecuenciaHoras: data.frecuenciaHoras as number,
        fechaFin: data.fechaFin as Date | null,
      })),
      listarActivas: vi.fn(),
      administrarBajoBloqueo: vi.fn(
        async (_id: string, decidir: (c: ContextoAdministracion) => NuevaAdministracion) => {
          const nueva = decidir({ indicacion: ind, administraciones: options.previas ?? [] });
          return {
            indicacion: ind as IndicacionData,
            administracion: { ...admin(nueva.fechaHoraAdministracion.toISOString()), id: 'adm-1', enfermeroId: nueva.enfermeroId, enfermero: 'López, Marta', observaciones: nueva.observaciones },
          };
        },
      ),
    };
    const pacientes = {
      get: vi.fn(async () => {
        if (options.pacienteExiste === false) throw new NotFoundException();
        return { id: 'patient-1' };
      }),
    };
    const events = new EventBus();
    const published: Array<{ type: string; payload: unknown }> = [];
    events.ofType(INTEGRATION_EVENTS.MEDICATION_ADMINISTERED).subscribe((event) => published.push(event));
    const service = new IndicacionesService(repository as never, pacientes as never, events);
    return { service, repository, pacientes, published };
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('crear', () => {
    beforeEach(() => vi.setSystemTime(new Date('2030-01-01T06:00:00.000Z')));

    it('stores the structured frequency and a readable text, linked to the doctor', async () => {
      const { service, repository } = build();
      await service.crear({ pacienteId: 'patient-1', insumoId: 'supply-1', dosis: '400 mg', frecuenciaHoras: 8 }, doctor);
      expect(repository.create).toHaveBeenCalledWith({
        pacienteId: 'patient-1',
        medicoId: 'doc-1',
        insumoId: 'supply-1',
        dosis: '400 mg',
        frecuencia: 'cada 8 horas',
        frecuenciaHoras: 8,
        fechaFin: null,
      });
    });

    it('rejects an end date in the past', async () => {
      const { service, repository } = build();
      await expect(
        service.crear(
          { pacienteId: 'patient-1', insumoId: 'supply-1', dosis: '400 mg', frecuenciaHoras: 8, fechaFin: '2029-12-31T00:00:00.000Z' },
          doctor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('404 when the patient does not exist', async () => {
      const { service, repository } = build({ pacienteExiste: false });
      await expect(
        service.crear({ pacienteId: 'x', insumoId: 'supply-1', dosis: '1', frecuenciaHoras: 8 }, doctor),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('404 when the supply does not exist', async () => {
      const { service, repository } = build({ insumoExiste: false });
      await expect(
        service.crear({ pacienteId: 'patient-1', insumoId: 'x', dosis: '1', frecuenciaHoras: 8 }, doctor),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('administrar', () => {
    it('confirms inside the window, links the nurse and publishes the event', async () => {
      vi.setSystemTime(new Date('2030-01-01T14:10:00.000Z'));
      const { service, published } = build();

      const result = await service.administrar('ind-1', { observaciones: 'ok' }, nurse);

      expect(result).toMatchObject({
        indicacionId: 'ind-1',
        dosisProgramadaPara: '2030-01-01T14:00:00.000Z',
        administradaPorId: 'nurse-1',
        administradaEn: '2030-01-01T14:10:00.000Z',
        observaciones: 'ok',
      });
      expect(published).toHaveLength(1);
      expect(published[0].payload).toEqual({
        patientId: 'patient-1',
        supplyId: 'supply-1',
        quantity: 1,
        administeredBy: 'nurse-1',
        administeredAt: '2030-01-01T14:10:00.000Z',
      });
    });

    it('accepts exactly +30 minutes', async () => {
      vi.setSystemTime(new Date('2030-01-01T14:30:00.000Z'));
      const { service } = build();
      await expect(service.administrar('ind-1', {}, nurse)).resolves.toBeDefined();
    });

    it('409 and no event at 31 minutes', async () => {
      vi.setSystemTime(new Date('2030-01-01T14:31:00.000Z'));
      const { service, published } = build();
      await expect(service.administrar('ind-1', {}, nurse)).rejects.toBeInstanceOf(ConflictException);
      expect(published).toHaveLength(0);
    });

    it('409 when the dose was already administered (double click)', async () => {
      vi.setSystemTime(new Date('2030-01-01T14:10:00.000Z'));
      const { service, published } = build({ previas: [admin('2030-01-01T14:02:00.000Z')] });
      await expect(service.administrar('ind-1', {}, nurse)).rejects.toThrow(/ya fue administrada/);
      expect(published).toHaveLength(0);
    });

    it('allows the next dose after the previous one was given', async () => {
      vi.setSystemTime(new Date('2030-01-01T22:00:00.000Z'));
      const { service } = build({ previas: [admin('2030-01-01T14:02:00.000Z')] });
      await expect(service.administrar('ind-1', {}, nurse)).resolves.toBeDefined();
    });

    it('409 for an expired indication', async () => {
      vi.setSystemTime(new Date('2030-01-01T14:00:00.000Z'));
      const { service, published } = build({ ind: { ...indicacion, fechaFin: new Date('2030-01-01T13:00:00.000Z') } });
      await expect(service.administrar('ind-1', {}, nurse)).rejects.toThrow(/vencida/);
      expect(published).toHaveLength(0);
    });

    it('409 before fechaInicio', async () => {
      vi.setSystemTime(new Date('2030-01-01T05:50:00.000Z'));
      const { service } = build();
      await expect(service.administrar('ind-1', {}, nurse)).rejects.toThrow(/todavía no comenzó/);
    });

    it('404 when the indication does not exist', async () => {
      vi.setSystemTime(new Date('2030-01-01T14:00:00.000Z'));
      const { service, published } = build({ ind: null });
      await expect(service.administrar('ind-1', {}, nurse)).rejects.toBeInstanceOf(NotFoundException);
      expect(published).toHaveLength(0);
    });

    it('clear 409 for legacy rows without frecuenciaHoras', async () => {
      vi.setSystemTime(new Date('2030-01-01T14:00:00.000Z'));
      const { service } = build({ ind: { ...indicacion, frecuenciaHoras: null } });
      await expect(service.administrar('ind-1', {}, nurse)).rejects.toThrow(/frecuencia estructurada/);
    });

    it('does not publish when the repository fails (transaction rolled back)', async () => {
      vi.setSystemTime(new Date('2030-01-01T14:00:00.000Z'));
      const { service, repository, published } = build();
      repository.administrarBajoBloqueo.mockRejectedValueOnce(new Error('db down'));
      await expect(service.administrar('ind-1', {}, nurse)).rejects.toThrow('db down');
      expect(published).toHaveLength(0);
    });
  });

  describe('listar', () => {
    it('shows today\'s doses with administered / pending state and window flag', async () => {
      vi.setSystemTime(new Date('2030-01-01T14:10:00.000Z'));
      const { service, repository } = build();
      repository.listarActivas.mockResolvedValue([
        { indicacion, administraciones: [admin('2030-01-01T06:05:00.000Z')] },
      ]);

      const [view] = await service.listar('patient-1');

      expect(repository.listarActivas).toHaveBeenCalledWith(
        'patient-1',
        new Date('2030-01-01T14:10:00.000Z'),
        new Date('2030-01-01T03:00:00.000Z'),
        100,
      );
      expect(view.dosisDelDia.map((d) => [d.programadaPara, d.estado, d.enVentana])).toEqual([
        ['2030-01-01T06:00:00.000Z', 'ADMINISTRADA', false],
        ['2030-01-01T14:00:00.000Z', 'PENDIENTE', true],
        ['2030-01-01T22:00:00.000Z', 'PENDIENTE', false],
      ]);
      expect(view.dosisDelDia[0].administradaPor).toBe('Pérez, Juan');
    });
  });
});
