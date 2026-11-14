import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';

import {Cargo,TipoAtencionFacturable,} from '../../../entities/cargo.entity.js';
import { Turno } from '../../../entities/turno.entity.js';
import { CoverageType } from '../../../shared/events/coverage-type.js';

import { coverageStrategyFor } from '../domain/coverage.strategy.js';
import { ConsultaRegularStrategy } from '../domain/consulta-regular.strategy.js';
import { ConsultaUrgenciaStrategy } from '../domain/consulta-urgencia.strategy.js';

import { Insumo } from '../../../entities/insumo.entity.js';
import { MedicationAdministeredPayload } from '../../../shared/events/medication-administered.event.js';

import { AdministracionMedicacion } from '../../../entities/administracion-medicacion.entity.js';
export interface CargoDetalle {
  id: string;
  turnoId: string | null;
  administrationId: string | null;
  concepto: string | null;
  importePesos: number;
  tipoAtencion: Cargo['tipoAtencion'];
  createdAt: Date;

  cobertura: {
    tipo: CoverageType;
    entidad: string | null;
    pacientePesos: number | null;
    terceroPesos: number | null;
  } | null;

  turno: {
    fechaHora: Date;
    duracionMinutos: number;
    urgente: boolean;
    medico: {
      id: string;
      nombre: string;
      apellido: string;
    };
    paciente: {
      id: string;
      nombre: string;
      apellido: string;
      documento: string;
    } | null;
  } | null;
}

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Cargo)
    private readonly cargos: Repository<Cargo>,

    @InjectRepository(Turno)
    private readonly turnos: Repository<Turno>,

    @InjectRepository(Insumo)
    private readonly insumos: Repository<Insumo>,

    @InjectRepository(AdministracionMedicacion)
    private readonly administraciones: Repository<AdministracionMedicacion>,

    private readonly consultaRegular: ConsultaRegularStrategy,
    private readonly consultaUrgencia: ConsultaUrgenciaStrategy,
  ) {}

  async createForAppointment(input: {
    appointmentId: string;
    urgente: boolean;
  }): Promise<Cargo> {
    const strategy = input.urgente
      ? this.consultaUrgencia
      : this.consultaRegular;

    const valorBase = strategy.calculateAmount();

    const turno = await this.turnos.findOne({
      where: { id: input.appointmentId },
      relations: { paciente: true },
    });

    const paciente = turno?.paciente ?? null;

    const reparto = paciente
      ? coverageStrategyFor(paciente.tipoCobertura).split(valorBase)
      : null;

    try {
      return await this.cargos.save(
        this.cargos.create({
          turnoId: input.appointmentId,
          importePesos: valorBase,
          tipoAtencion: strategy.tipoAtencion,
          tipoCobertura: paciente?.tipoCobertura ?? null,
          entidadCobertura: paciente?.entidadCobertura ?? null,
          importePacientePesos: reparto?.pacientePesos ?? null,
          importeTerceroPesos: reparto?.terceroPesos ?? null,
        }),
      );
    } catch (error) {
      if (!this.isDuplicateAppointmentCharge(error)) {
        throw error;
      }

      return this.cargos.findOneByOrFail({
        turnoId: input.appointmentId,
      });
    }
  }
  async createForMedicationAdministration(
  input: MedicationAdministeredPayload,
 ): Promise<Cargo> {
  const administracion = await this.administraciones.findOne({
  where: { id: input.administrationId },
  relations: {
    indicacion: {
      paciente: true,
      insumo: true,
    },
  },
});

if (!administracion) {
  throw new Error('No se encontró la administración del medicamento.');
}

if (
  administracion.indicacion.paciente.id !== input.patientId ||
  administracion.indicacion.insumo.id !== input.supplyId
) {
  throw new Error(
    'La administración no coincide con el paciente o el insumo informado.',
  );
}
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error('La cantidad administrada debe ser mayor a cero.');
  }

  const insumo = await this.insumos.findOneByOrFail({
    id: input.supplyId,
  });

  if (!Number.isInteger(insumo.precioPesos) || insumo.precioPesos <= 0) {
    throw new Error('El insumo no tiene un precio válido.');
  }

  const importePesos = insumo.precioPesos * input.quantity;

  if (!Number.isSafeInteger(importePesos)) {
    throw new Error('El importe del cargo de farmacia no es válido.');
  }

  try {
    return await this.cargos.save(
      this.cargos.create({
        turnoId: null,
        administrationId: input.administrationId,
        concepto: 'Insumos de Farmacia',
        importePesos,
        tipoAtencion: TipoAtencionFacturable.FARMACIA,
        tipoCobertura: null,
        entidadCobertura: null,
        importePacientePesos: null,
        importeTerceroPesos: null,
      }),
    );
  } catch (error) {
    if (!this.isDuplicateAppointmentCharge(error)) {
      throw error;
    }

    return this.cargos.findOneByOrFail({
      administrationId: input.administrationId,
    });
  }
 }

  async list(): Promise<CargoDetalle[]> {
    const cargos = await this.cargos.find({
      order: { createdAt: 'DESC' },
    });

    if (cargos.length === 0) {
      return [];
    }


    const turnoIds = cargos
      .map((cargo) => cargo.turnoId)
      .filter((id): id is string => id !== null);

    const turnos = turnoIds.length
      ? await this.turnos.find({
          where: { id: In(turnoIds) },
          relations: { medico: true, paciente: true },
        })
      : [];

    const byId = new Map(
      turnos.map((turno) => [turno.id, turno]),
    );

    return cargos.map((cargo) => {
      const turno = cargo.turnoId
        ? byId.get(cargo.turnoId)
        : undefined;

      return {
        id: cargo.id,
        turnoId: cargo.turnoId,
        administrationId: cargo.administrationId,
        concepto: cargo.concepto,
        importePesos: cargo.importePesos,
        tipoAtencion: cargo.tipoAtencion,
        createdAt: cargo.createdAt,

        cobertura: cargo.tipoCobertura
          ? {
              tipo: cargo.tipoCobertura,
              entidad: cargo.entidadCobertura,
              pacientePesos: cargo.importePacientePesos,
              terceroPesos: cargo.importeTerceroPesos,
            }
          : null,

        turno: turno
          ? {
              fechaHora: turno.fechaHora,
              duracionMinutos: turno.duracionMinutos,
              urgente: turno.urgente,

              medico: {
                id: turno.medico.id,
                nombre: turno.medico.nombre,
                apellido: turno.medico.apellido,
              },

              paciente: turno.paciente
                ? {
                    id: turno.paciente.id,
                    nombre: turno.paciente.nombre,
                    apellido: turno.paciente.apellido,
                    documento: turno.paciente.documento,
                  }
                : null,
            }
          : null,
      };
    });
  }

  private isDuplicateAppointmentCharge(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === '23505'
    );
  }
  async resumen(): Promise<{
  tipoCobertura: string | null;
  cantidad: number;
  totalPesos: number;
  pacientePesos: number;
  terceroPesos: number;
}[]> {
  const rows = await this.cargos
    .createQueryBuilder('c')
    .select('c.tipoCobertura', 'tipoCobertura')
    .addSelect('COUNT(*)', 'cantidad')
    .addSelect('COALESCE(SUM(c.importePesos), 0)', 'totalPesos')
    .addSelect('COALESCE(SUM(c.importePacientePesos), 0)', 'pacientePesos')
    .addSelect('COALESCE(SUM(c.importeTerceroPesos), 0)', 'terceroPesos')
    .groupBy('c.tipoCobertura')
    .getRawMany();
  return rows.map((r) => ({
    tipoCobertura: r.tipoCobertura,
    cantidad: Number(r.cantidad),
    totalPesos: Number(r.totalPesos),
    pacientePesos: Number(r.pacientePesos),
    terceroPesos: Number(r.terceroPesos),
  }));
}
}
