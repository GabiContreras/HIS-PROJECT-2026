import { describe, expect, it, vi } from 'vitest';
import { QueryFailedError } from 'typeorm';
import { Cargo, TipoAtencionFacturable } from '../../../entities/cargo.entity.js';
import { BedReleasedPayload } from '../../../shared/events/bed-released.event.js';
import { CoverageType } from '../../../shared/events/coverage-type.js';
import { EstadiaInvalidaError } from '../domain/dias-cama.js';
import { PrestacionNoEncontradaError } from '../domain/nomenclador.js';
import { BillingService } from './billing.service.js';
import { NomencladorService } from './nomenclador.service.js';

const prestacionDiaCama = {
  id: 'prestacion-dia-cama',
  codigo: 'DIA_CAMA',
  valorBasePesos: 40_000,
  copagoPesos: 2_500,
};

const payload: BedReleasedPayload = {
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

function build(options: {
  paciente?: Record<string, unknown> | null;
  prestacion?: typeof prestacionDiaCama | null;
  tarifa?: { valorPesos: number; copagoPesos: number | null } | null;
  saveError?: unknown;
  existing?: Partial<Cargo>;
}) {
  const paciente =
    options.paciente === undefined
      ? {
          id: 'paciente-1',
          tipoCobertura: CoverageType.SELF_PAY,
          entidadCobertura: null,
          financiadorId: null,
        }
      : options.paciente;
  const cargos = {
    create: vi.fn((input: Partial<Cargo>) => input),
    save: vi.fn(async (input: Partial<Cargo>) => {
      if (options.saveError) throw options.saveError;
      return { id: 'cargo-1', ...input } as Cargo;
    }),
    findOneByOrFail: vi.fn(async () => options.existing as Cargo),
  };
  const pacientes = { findOneBy: vi.fn(async () => paciente) };
  const repositorio = {
    findPrestacionActiva: vi.fn(async () =>
      options.prestacion === undefined ? prestacionDiaCama : options.prestacion,
    ),
    findTarifaActiva: vi.fn(async () => options.tarifa ?? null),
  };
  const service = new BillingService(
    cargos as never,
    {} as never,
    {} as never,
    {} as never,
    pacientes as never,
    new NomencladorService(repositorio),
    {} as never,
    {} as never,
  );
  return { service, cargos, pacientes, repositorio };
}

const duplicateError = () =>
  new QueryFailedError(
    'INSERT INTO cargos',
    [],
    Object.assign(new Error('duplicate key'), { code: '23505' }),
  );

describe('BillingService.createForBedStay', () => {
  it('particular: 3 días a valor base, el paciente paga todo', async () => {
    const { service, cargos } = build({});

    await service.createForBedStay(payload);

    expect(cargos.create).toHaveBeenCalledWith({
      turnoId: null,
      administrationId: null,
      internacionId: 'int-1',
      concepto: 'Internación: 3 días de cama',
      importePesos: 120_000,
      tipoAtencion: TipoAtencionFacturable.INTERNACION,
      tipoCobertura: CoverageType.SELF_PAY,
      entidadCobertura: null,
      financiadorId: null,
      importePacientePesos: 120_000,
      importeTerceroPesos: 0,
    });
  });

  it('obra social pública: el paciente paga cero', async () => {
    const { service, cargos } = build({
      paciente: {
        id: 'paciente-1',
        tipoCobertura: CoverageType.PUBLIC_INSURANCE,
        entidadCobertura: 'PAMI',
        financiadorId: null,
      },
    });

    await service.createForBedStay(payload);

    expect(cargos.create).toHaveBeenCalledWith(
      expect.objectContaining({
        importePesos: 120_000,
        entidadCobertura: 'PAMI',
        importePacientePesos: 0,
        importeTerceroPesos: 120_000,
      }),
    );
  });

  it('prepaga: el copago se aplica una sola vez sobre el total y no por día', async () => {
    const { service, cargos } = build({
      paciente: {
        id: 'paciente-1',
        tipoCobertura: CoverageType.PREPAID,
        entidadCobertura: 'Galeno',
        financiadorId: null,
      },
    });

    await service.createForBedStay(payload);

    expect(cargos.create).toHaveBeenCalledWith(
      expect.objectContaining({
        importePesos: 120_000,
        importePacientePesos: 2_500,
        importeTerceroPesos: 117_500,
      }),
    );
  });

  it('con tarifa del financiador usa su valor y su copago', async () => {
    const { service, cargos, repositorio } = build({
      paciente: {
        id: 'paciente-1',
        tipoCobertura: CoverageType.PREPAID,
        entidadCobertura: 'Galeno',
        financiadorId: 'fin-1',
      },
      tarifa: { valorPesos: 30_000, copagoPesos: 1_000 },
    });

    await service.createForBedStay(payload);

    expect(repositorio.findTarifaActiva).toHaveBeenCalledWith('fin-1', 'prestacion-dia-cama');
    expect(cargos.create).toHaveBeenCalledWith(
      expect.objectContaining({
        importePesos: 90_000,
        importePacientePesos: 1_000,
        importeTerceroPesos: 89_000,
      }),
    );
  });

  it('con financiador sin tarifa usa el valor base de la prestación', async () => {
    const { service, cargos } = build({
      paciente: {
        id: 'paciente-1',
        tipoCobertura: CoverageType.PREPAID,
        entidadCobertura: 'Galeno',
        financiadorId: 'fin-1',
      },
      tarifa: null,
    });

    await service.createForBedStay(payload);

    expect(cargos.create).toHaveBeenCalledWith(
      expect.objectContaining({ importePesos: 120_000, importePacientePesos: 2_500 }),
    );
  });

  it('una internación de menos de un día cobra 1 día', async () => {
    const { service, cargos } = build({});

    await service.createForBedStay({
      ...payload,
      fechaIngreso: '2026-11-12T10:00:00.000Z',
      fechaEgreso: '2026-11-12T12:00:00.000Z',
    });

    expect(cargos.create).toHaveBeenCalledWith(
      expect.objectContaining({ concepto: 'Internación: 1 días de cama', importePesos: 40_000 }),
    );
  });

  it('un evento duplicado devuelve el cargo existente sin crear otro', async () => {
    const existing = { id: 'cargo-existente', internacionId: 'int-1' };
    const { service, cargos } = build({ saveError: duplicateError(), existing });

    const result = await service.createForBedStay(payload);

    expect(result).toBe(existing);
    expect(cargos.findOneByOrFail).toHaveBeenCalledWith({ internacionId: 'int-1' });
  });

  it('propaga los errores de base que no son de unicidad', async () => {
    const { service } = build({ saveError: new Error('db caída') });

    await expect(service.createForBedStay(payload)).rejects.toThrow('db caída');
  });

  it('falla con error claro si DIA_CAMA no existe en el nomenclador y no crea cargo', async () => {
    const { service, cargos } = build({ prestacion: null });

    await expect(service.createForBedStay(payload)).rejects.toThrow(PrestacionNoEncontradaError);
    expect(cargos.save).not.toHaveBeenCalled();
  });

  it('rechaza un egreso anterior al ingreso sin consultar nada ni crear cargo', async () => {
    const { service, cargos, pacientes } = build({});

    await expect(
      service.createForBedStay({
        ...payload,
        fechaIngreso: '2026-11-12T12:00:00.000Z',
        fechaEgreso: '2026-11-09T13:00:00.000Z',
      }),
    ).rejects.toThrow(EstadiaInvalidaError);
    expect(pacientes.findOneBy).not.toHaveBeenCalled();
    expect(cargos.save).not.toHaveBeenCalled();
  });

  it('rechaza fechas inválidas', async () => {
    const { service, cargos } = build({});

    await expect(
      service.createForBedStay({ ...payload, fechaEgreso: 'nada' }),
    ).rejects.toThrow(EstadiaInvalidaError);
    expect(cargos.save).not.toHaveBeenCalled();
  });

  it('falla con error claro si el paciente no existe', async () => {
    const { service, cargos } = build({ paciente: null });

    await expect(service.createForBedStay(payload)).rejects.toThrow(
      'No se encontró el paciente paciente-1',
    );
    expect(cargos.save).not.toHaveBeenCalled();
  });
});
