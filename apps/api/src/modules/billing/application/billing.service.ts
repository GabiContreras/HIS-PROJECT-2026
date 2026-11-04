import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { Cargo } from '../../../entities/cargo.entity.js';
import { Turno } from '../../../entities/turno.entity.js';
import { CoverageType } from '../../../shared/events/coverage-type.js';
import { coverageStrategyFor } from '../domain/coverage.strategy.js';
import { ConsultaRegularStrategy } from '../domain/consulta-regular.strategy.js';
import { ConsultaUrgenciaStrategy } from '../domain/consulta-urgencia.strategy.js';

/** Cargo con el turno que lo originó (paciente, médico y fecha) para mostrar el detalle. */
export interface CargoDetalle {
  id: string;
  turnoId: string;
  importePesos: number;
  tipoAtencion: Cargo['tipoAtencion'];
  createdAt: Date;
  /** null en cargos anteriores al registro de coberturas. */
  cobertura: {
    tipo: CoverageType;
    entidad: string | null;
    pacientePesos: number | null;
    terceroPesos: number | null;
  } | null;
  /** null si el turno ya no se puede leer. */
  turno: {
    fechaHora: Date;
    duracionMinutos: number;
    urgente: boolean;
    medico: { id: string; nombre: string; apellido: string };
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
    // La cobertura del paciente se congela en el cargo: cambiarla después no reescribe lo facturado.
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
      if (!this.isDuplicateAppointmentCharge(error)) throw error;
      return this.cargos.findOneByOrFail({ turnoId: input.appointmentId });
    }
  }

  async list(): Promise<CargoDetalle[]> {
    const cargos = await this.cargos.find({ order: { createdAt: 'DESC' } });
    if (cargos.length === 0) return [];
    const turnos = await this.turnos.find({
      where: { id: In(cargos.map((cargo) => cargo.turnoId)) },
      relations: { medico: true, paciente: true },
    });
    const byId = new Map(turnos.map((turno) => [turno.id, turno]));
    return cargos.map((cargo) => {
      const turno = byId.get(cargo.turnoId);
      return {
        id: cargo.id,
        turnoId: cargo.turnoId,
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
}
