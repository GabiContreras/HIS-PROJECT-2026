import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { INTEGRATION_EVENTS } from '../../../shared/events/integration-event-names.js';
import type { SessionIdentity } from '../../iam/application/auth.service.js';
import { TipoSignoVital } from '../domain/vital-sign-rules.js';
import type { NuevoSignoVital } from '../domain/ports/signos-vitales.repository.js';
import { SignosVitalesService } from './signos-vitales.service.js';

describe('SignosVitalesService', () => {
  const identity: SessionIdentity = {
    accountId: 'nurse-1',
    sessionId: 'session-1',
    rol: RolUsuario.ENFERMERO,
    esSuperadmin: false,
  };

  function build(options: { patientExists?: boolean } = {}) {
    const repository = {
      create: vi.fn(async (data: NuevoSignoVital) => ({
        id: 'vital-1',
        pacienteId: data.pacienteId,
        paciente: 'López, Carlos',
        tipo: data.tipo,
        valor: data.valor,
        fechaHora: new Date('2030-01-01T10:00:00.000Z'),
      })),
      list: vi.fn(),
    };
    const pacientes = {
      get: vi.fn(async () => {
        if (options.patientExists === false) throw new NotFoundException();
        return { id: 'patient-1' };
      }),
    };
    const events = new EventBus();
    const published: unknown[] = [];
    events.ofType(INTEGRATION_EVENTS.VITAL_SIGN_ALERT).subscribe((event) => published.push(event));
    const service = new SignosVitalesService(repository as never, pacientes as never, events);
    return { service, repository, published };
  }

  it('stores a stable reading without raising an alert', async () => {
    const { service, repository, published } = build();

    const result = await service.registrar(
      { pacienteId: 'patient-1', tipo: TipoSignoVital.TEMPERATURA, valor: 36.8 },
      identity,
    );

    expect(repository.create).toHaveBeenCalledWith({
      pacienteId: 'patient-1',
      registradoPorId: 'nurse-1',
      tipo: 'TEMPERATURA',
      valor: 36.8,
    });
    expect(result).toMatchObject({ valor: 36.8, unidad: '°C', fueraDeRango: false, paciente: 'López, Carlos' });
    expect(published).toHaveLength(0);
  });

  it('flags a temperature above 39 °C and publishes a high-priority alert event', async () => {
    const { service, published } = build();

    const result = await service.registrar(
      { pacienteId: 'patient-1', tipo: TipoSignoVital.TEMPERATURA, valor: 39.5 },
      identity,
    );

    expect(result.fueraDeRango).toBe(true);
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({
      type: INTEGRATION_EVENTS.VITAL_SIGN_ALERT,
      payload: { patientId: 'patient-1', tipo: 'TEMPERATURA', valor: 39.5, registeredBy: 'nurse-1' },
    });
  });

  it('does not treat exactly 39 °C as out of range', async () => {
    const { service } = build();
    const result = await service.registrar(
      { pacienteId: 'patient-1', tipo: TipoSignoVital.TEMPERATURA, valor: 39 },
      identity,
    );
    expect(result.fueraDeRango).toBe(false);
  });

  it('rejects implausible values with 400 before touching the database', async () => {
    const { service, repository } = build();
    await expect(
      service.registrar({ pacienteId: 'patient-1', tipo: TipoSignoVital.SATURACION_O2, valor: 140 }, identity),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('propagates 404 when the patient does not exist', async () => {
    const { service, repository } = build({ patientExists: false });
    await expect(
      service.registrar({ pacienteId: 'missing', tipo: TipoSignoVital.FRECUENCIA_CARDIACA, valor: 80 }, identity),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('lists readings flagging the out-of-range ones', async () => {
    const { service, repository } = build();
    repository.list.mockResolvedValue([
      {
        id: 'v1',
        pacienteId: 'patient-1',
        paciente: 'López, Carlos',
        tipo: 'FRECUENCIA_CARDIACA',
        valor: 130,
        fechaHora: new Date('2030-01-01T10:00:00.000Z'),
      },
    ]);

    const [row] = await service.listar();

    expect(repository.list).toHaveBeenCalledWith(undefined, 100);
    expect(row).toMatchObject({ valor: 130, unidad: 'lpm', fueraDeRango: true });
  });
});
