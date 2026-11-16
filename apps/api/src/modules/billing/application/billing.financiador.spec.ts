import { describe, expect, it, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { Cargo, EstadoCargo, TipoAtencionFacturable } from '../../../entities/cargo.entity.js';
import { TipoIndicacion } from '../../../entities/indicacion-medica.entity.js';
import { CoverageType } from '../../../shared/events/coverage-type.js';
import { ConsultaRegularStrategy } from '../domain/consulta-regular.strategy.js';
import { ConsultaUrgenciaStrategy } from '../domain/consulta-urgencia.strategy.js';
import { BillingService } from './billing.service.js';

const FINANCIADOR_ID = '550e8400-e29b-41d4-a716-446655440010';

const pacienteConFinanciador = {
  id: 'paciente-1',
  tipoCobertura: CoverageType.PREPAID,
  entidadCobertura: 'Galeno',
  financiadorId: FINANCIADOR_ID,
};

const pacienteSinFinanciador = {
  id: 'paciente-1',
  tipoCobertura: CoverageType.SELF_PAY,
  entidadCobertura: null,
  financiadorId: null,
};

function build(paciente: typeof pacienteConFinanciador | typeof pacienteSinFinanciador) {
  const cargos = {
    create: vi.fn((input: Partial<Cargo>) => input),
    save: vi.fn(async (input: Partial<Cargo>) => ({ id: 'cargo-1', ...input }) as Cargo),
  };
  const turnos = { findOne: vi.fn(async () => ({ id: 'turno-1', paciente })) };
  const administraciones = {
    findOne: vi.fn(async () => ({
      id: 'adm-1',
      indicacion: {
        tipo: TipoIndicacion.MEDICACION,
        paciente,
        insumo: { id: 'insumo-1' },
      },
    })),
  };
  const insumos = { findOneByOrFail: vi.fn(async () => ({ id: 'insumo-1', precioPesos: 1_000 })) };
  const pacientes = { findOneBy: vi.fn(async () => paciente) };
  const nomenclador = { resolve: vi.fn(async () => ({ valorPesos: 40_000, copagoPesos: 2_500 })) };
  const service = new BillingService(
    cargos as never,
    turnos as never,
    insumos as never,
    administraciones as never,
    pacientes as never,
    nomenclador as never,
    new ConsultaRegularStrategy(),
    new ConsultaUrgenciaStrategy(),
  );
  return { service, cargos };
}

const creado = (cargos: ReturnType<typeof build>['cargos']): Partial<Cargo> =>
  cargos.create.mock.calls[0][0];

describe('BillingService guarda el financiador del paciente en cada cargo nuevo', () => {
  it.each([
    ['consulta regular', false],
    ['consulta de urgencia', true],
  ])('%s: paciente con financiador', async (_nombre, urgente) => {
    const { service, cargos } = build(pacienteConFinanciador);

    await service.createForAppointment({ appointmentId: 'turno-1', urgente });

    expect(creado(cargos).financiadorId).toBe(FINANCIADOR_ID);
    expect(creado(cargos).tipoAtencion).toBe(
      urgente ? TipoAtencionFacturable.URGENCIA : TipoAtencionFacturable.REGULAR,
    );
  });

  it.each([
    ['consulta regular', false],
    ['consulta de urgencia', true],
  ])('%s: paciente sin financiador', async (_nombre, urgente) => {
    const { service, cargos } = build(pacienteSinFinanciador);

    await service.createForAppointment({ appointmentId: 'turno-1', urgente });

    expect(creado(cargos).financiadorId).toBeNull();
  });

  it('farmacia: paciente con financiador', async () => {
    const { service, cargos } = build(pacienteConFinanciador);

    await service.createForMedicationAdministration({
      administrationId: 'adm-1',
      patientId: 'paciente-1',
      supplyId: 'insumo-1',
      quantity: 2,
    } as never);

    expect(creado(cargos).financiadorId).toBe(FINANCIADOR_ID);
    expect(creado(cargos).tipoAtencion).toBe(TipoAtencionFacturable.FARMACIA);
  });

  it('farmacia: paciente sin financiador', async () => {
    const { service, cargos } = build(pacienteSinFinanciador);

    await service.createForMedicationAdministration({
      administrationId: 'adm-1',
      patientId: 'paciente-1',
      supplyId: 'insumo-1',
      quantity: 2,
    } as never);

    expect(creado(cargos).financiadorId).toBeNull();
  });

  const alta = {
    bedId: 'cama-1',
    camaId: 'cama-1',
    bedNumber: '101',
    patientId: 'paciente-1',
    admissionId: 'int-1',
    releasedAt: '2026-11-12T12:00:00.000Z',
    internacionId: 'int-1',
    fechaIngreso: '2026-11-09T13:00:00.000Z',
    fechaEgreso: '2026-11-12T12:00:00.000Z',
  };

  it('internacion: paciente con financiador', async () => {
    const { service, cargos } = build(pacienteConFinanciador);

    await service.createForBedStay(alta);

    expect(creado(cargos).financiadorId).toBe(FINANCIADOR_ID);
    expect(creado(cargos).tipoAtencion).toBe(TipoAtencionFacturable.INTERNACION);
  });

  it('internacion: paciente sin financiador', async () => {
    const { service, cargos } = build(pacienteSinFinanciador);

    await service.createForBedStay(alta);

    expect(creado(cargos).financiadorId).toBeNull();
  });

  it('consulta sin paciente: el financiador queda en null', async () => {
    const { service, cargos } = build(pacienteConFinanciador);
    const turnos = (service as unknown as { turnos: { findOne: ReturnType<typeof vi.fn> } }).turnos;
    turnos.findOne.mockResolvedValue(null);

    await service.createForAppointment({ appointmentId: 'turno-1', urgente: false });

    expect(creado(cargos).financiadorId).toBeNull();
  });
});

function buildEstado(cargo: Partial<Cargo>) {
  const findOne = vi.fn(async () => cargo);
  const save = vi.fn(async (entity: Cargo) => entity);
  const manager = { getRepository: () => ({ findOne, save }) };
  const transaction = vi.fn(async (work: (m: unknown) => unknown) => work(manager));
  const service = Object.create(BillingService.prototype) as BillingService;
  Object.assign(service, { cargos: { manager: { transaction } } });
  return { service, save };
}

describe('BillingService con cargos liquidados', () => {
  it('responde 409 al anular un cargo liquidado y no guarda', async () => {
    const { service, save } = buildEstado({
      id: 'c1',
      estado: EstadoCargo.FACTURADO,
      liquidacionId: 'liq-1',
    });

    const intento = service.anular('c1');

    await expect(intento).rejects.toBeInstanceOf(ConflictException);
    await expect(intento).rejects.toThrow('ya está liquidado');
    expect(save).not.toHaveBeenCalled();
  });

  it('anula un cargo FACTURADO sin liquidacion, como antes', async () => {
    const { service, save } = buildEstado({
      id: 'c1',
      estado: EstadoCargo.FACTURADO,
      liquidacionId: null,
    });

    const result = await service.anular('c1');

    expect(result.estado).toBe(EstadoCargo.ANULADO);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('anula un cargo PENDIENTE sin liquidacion', async () => {
    const { service } = buildEstado({ id: 'c1', estado: EstadoCargo.PENDIENTE, liquidacionId: null });

    await expect(service.anular('c1')).resolves.toMatchObject({ estado: EstadoCargo.ANULADO });
  });

  it('paga un cargo liquidado', async () => {
    const { service, save } = buildEstado({
      id: 'c1',
      estado: EstadoCargo.FACTURADO,
      liquidacionId: 'liq-1',
    });

    const result = await service.pagar('c1');

    expect(result.estado).toBe(EstadoCargo.PAGADO);
    expect(result.liquidacionId).toBe('liq-1');
    expect(save).toHaveBeenCalledTimes(1);
  });
});
