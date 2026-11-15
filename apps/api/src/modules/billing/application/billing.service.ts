import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, QueryFailedError, Repository, SelectQueryBuilder } from 'typeorm';

import {Cargo,EstadoCargo,TipoAtencionFacturable,} from '../../../entities/cargo.entity.js';
import { Turno } from '../../../entities/turno.entity.js';
import { CoverageType } from '../../../shared/events/coverage-type.js';

import { NomencladorService } from './nomenclador.service.js';
import { coverageStrategyFor } from '../domain/coverage.strategy.js';
import { ConsultaRegularStrategy } from '../domain/consulta-regular.strategy.js';
import { ConsultaUrgenciaStrategy } from '../domain/consulta-urgencia.strategy.js';
import {
  CargoState,
  cargoStateFor,
  InvalidCargoTransitionError,
} from '../domain/estado-cargo.js';

import { Insumo } from '../../../entities/insumo.entity.js';
import { MedicationAdministeredPayload } from '../../../shared/events/medication-administered.event.js';

import { AdministracionMedicacion } from '../../../entities/administracion-medicacion.entity.js';
import { TipoIndicacion } from '../../../entities/indicacion-medica.entity.js';
import { Paciente } from '../../../entities/paciente.entity.js';
import { Internacion } from '../../../entities/internacion.entity.js';
import { BedReleasedPayload } from '../../../shared/events/bed-released.event.js';
import { calcularDiasCama } from '../domain/dias-cama.js';
import { PrestacionCodigo } from '../domain/nomenclador.js';
import { cabeceraCsvCargos, filaCsvCargo } from '../domain/csv-cargos.js';
import {
  armarFiltroCargos,
  FiltroCargos,
  FiltroCargosEntrada,
} from '../domain/filtro-cargos.js';
import { PeriodoInvalidoError } from '../domain/periodo-reporte.js';

const LOTE_EXPORTACION = 500;

const CARGOS_DEL_PACIENTE = `
  SELECT cp.id FROM cargos cp
  JOIN turnos t ON t.id = cp.turno_id
  WHERE t.paciente_id = :pacienteId
  UNION ALL
  SELECT cp.id FROM cargos cp
  JOIN internaciones i ON i.id = cp.internacion_id
  WHERE i.paciente_id = :pacienteId
  UNION ALL
  SELECT cp.id FROM cargos cp
  JOIN administraciones_medicacion a ON a.id = cp.administration_id
  JOIN indicaciones_medicas im ON im.id = a.indicacion_id
  WHERE im.paciente_id = :pacienteId
`;

export interface PaginaCargos {
  items: CargoDetalle[];
  total: number;
  limit: number;
  offset: number;
}

export interface PacienteDetalle {
  id: string;
  nombre: string;
  apellido: string;
  documento: string;
}

export interface CargoDetalle {
  id: string;
  turnoId: string | null;
  administrationId: string | null;
  concepto: string | null;
  importePesos: number;
  tipoAtencion: Cargo['tipoAtencion'];
  estado: EstadoCargo;
  createdAt: Date;

  cobertura: {
    tipo: CoverageType;
    entidad: string | null;
    pacientePesos: number | null;
    terceroPesos: number | null;
  } | null;

  paciente: PacienteDetalle | null;

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

    @InjectRepository(Paciente)
    private readonly pacientes: Repository<Paciente>,

    private readonly nomenclador: NomencladorService,

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

    const turno = await this.turnos.findOne({
      where: { id: input.appointmentId },
      relations: { paciente: true },
    });

    const paciente = turno?.paciente ?? null;

    const { valorPesos: valorBase, copagoPesos } =
      await this.nomenclador.resolve(
        strategy.prestacion,
        paciente?.financiadorId ?? null,
      );

    const reparto = paciente
      ? coverageStrategyFor(paciente.tipoCobertura).split(valorBase, copagoPesos)
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
  administracion.indicacion.tipo !== TipoIndicacion.MEDICACION ||
  !administracion.indicacion.insumo ||
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

  async createForBedStay(input: BedReleasedPayload): Promise<Cargo> {
    const dias = calcularDiasCama(input.fechaIngreso, input.fechaEgreso);

    const paciente = await this.pacientes.findOneBy({ id: input.patientId });
    if (!paciente) {
      throw new Error(
        `No se encontró el paciente ${input.patientId} de la internación ${input.internacionId}.`,
      );
    }

    const { valorPesos: valorDia, copagoPesos } = await this.nomenclador.resolve(
      PrestacionCodigo.DIA_CAMA,
      paciente.financiadorId ?? null,
    );

    const importePesos = dias * valorDia;
    if (!Number.isSafeInteger(importePesos)) {
      throw new Error('El importe del cargo de internación no es válido.');
    }

    const reparto = coverageStrategyFor(paciente.tipoCobertura).split(
      importePesos,
      copagoPesos,
    );

    try {
      return await this.cargos.save(
        this.cargos.create({
          turnoId: null,
          administrationId: null,
          internacionId: input.internacionId,
          concepto: `Internación: ${dias} días de cama`,
          importePesos,
          tipoAtencion: TipoAtencionFacturable.INTERNACION,
          tipoCobertura: paciente.tipoCobertura,
          entidadCobertura: paciente.entidadCobertura ?? null,
          importePacientePesos: reparto.pacientePesos,
          importeTerceroPesos: reparto.terceroPesos,
        }),
      );
    } catch (error) {
      if (!this.isDuplicateAppointmentCharge(error)) {
        throw error;
      }

      return this.cargos.findOneByOrFail({
        internacionId: input.internacionId,
      });
    }
  }

  async list(
    entrada: FiltroCargosEntrada,
    limit: number,
    offset: number,
  ): Promise<PaginaCargos> {
    const filtro = this.armarFiltro(entrada);

    const [cargos, total] = await Promise.all([
      this.cargosFiltrados(filtro).offset(offset).limit(limit).getMany(),
      this.cargosFiltrados(filtro).getCount(),
    ]);

    return { items: await this.detallar(cargos), total, limit, offset };
  }

  exportarCsv(entrada: FiltroCargosEntrada): AsyncGenerator<string> {
    return this.generarCsv(this.armarFiltro(entrada));
  }

  private async *generarCsv(filtro: FiltroCargos): AsyncGenerator<string> {
    yield cabeceraCsvCargos();

    let cursor: { creado: string; id: string } | null = null;
    for (;;) {
      const consulta = this.cargosFiltrados(filtro)
        .addSelect('CAST(c.createdAt AS text)', 'cursor_creado')
        .limit(LOTE_EXPORTACION);
      if (cursor) {
        consulta.andWhere(
          '(c.createdAt, c.id) < (CAST(:cursorCreado AS timestamptz), CAST(:cursorId AS uuid))',
          { cursorCreado: cursor.creado, cursorId: cursor.id },
        );
      }

      const { entities, raw } = await consulta.getRawAndEntities<{ cursor_creado: string }>();
      if (entities.length === 0) {
        return;
      }

      const detalles = await this.detallar(entities);
      yield detalles.map(filaCsvCargo).join('');

      if (entities.length < LOTE_EXPORTACION) {
        return;
      }
      cursor = {
        creado: raw[raw.length - 1].cursor_creado,
        id: entities[entities.length - 1].id,
      };
    }
  }

  private armarFiltro(entrada: FiltroCargosEntrada): FiltroCargos {
    try {
      return armarFiltroCargos(entrada);
    } catch (error) {
      if (error instanceof PeriodoInvalidoError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private cargosFiltrados(filtro: FiltroCargos): SelectQueryBuilder<Cargo> {
    const consulta = this.cargos.createQueryBuilder('c');

    if (filtro.inicio) {
      consulta.andWhere('c.createdAt >= :inicio', { inicio: filtro.inicio });
    }
    if (filtro.finExclusivo) {
      consulta.andWhere('c.createdAt < :finExclusivo', { finExclusivo: filtro.finExclusivo });
    }
    if (filtro.estado) {
      consulta.andWhere('c.estado = :estado', { estado: filtro.estado });
    }
    if (filtro.tipoAtencion) {
      consulta.andWhere('c.tipoAtencion = :tipoAtencion', { tipoAtencion: filtro.tipoAtencion });
    }
    if (filtro.pacienteId) {
      consulta.andWhere(`c.id IN (${CARGOS_DEL_PACIENTE})`, { pacienteId: filtro.pacienteId });
    }

    return consulta.orderBy('c.createdAt', 'DESC').addOrderBy('c.id', 'DESC');
  }

  private async detallar(cargos: Cargo[]): Promise<CargoDetalle[]> {
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

    const pacientesDeOtrosCargos = await this.pacientesSinTurno(cargos);

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
        estado: cargo.estado,
        createdAt: cargo.createdAt,

        cobertura: cargo.tipoCobertura
          ? {
              tipo: cargo.tipoCobertura,
              entidad: cargo.entidadCobertura,
              pacientePesos: cargo.importePacientePesos,
              terceroPesos: cargo.importeTerceroPesos,
            }
          : null,

        paciente: turno
          ? this.aPacienteDetalle(turno.paciente)
          : this.pacienteDeCargoSinTurno(cargo, pacientesDeOtrosCargos),

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

  private aPacienteDetalle(paciente: Paciente | null | undefined): PacienteDetalle | null {
    return paciente
      ? {
          id: paciente.id,
          nombre: paciente.nombre,
          apellido: paciente.apellido,
          documento: paciente.documento,
        }
      : null;
  }

  private pacienteDeCargoSinTurno(
    cargo: Cargo,
    resueltos: { porInternacion: Map<string, PacienteDetalle>; porAdministracion: Map<string, PacienteDetalle> },
  ): PacienteDetalle | null {
    if (cargo.internacionId) {
      return resueltos.porInternacion.get(cargo.internacionId) ?? null;
    }
    if (cargo.administrationId) {
      return resueltos.porAdministracion.get(cargo.administrationId) ?? null;
    }
    return null;
  }

  private async pacientesSinTurno(cargos: Cargo[]): Promise<{
    porInternacion: Map<string, PacienteDetalle>;
    porAdministracion: Map<string, PacienteDetalle>;
  }> {
    const internacionIds = cargos
      .map((cargo) => cargo.internacionId)
      .filter((id): id is string => Boolean(id));
    const administracionIds = cargos
      .map((cargo) => cargo.administrationId)
      .filter((id): id is string => Boolean(id));

    const internaciones = internacionIds.length
      ? await this.cargos.manager.getRepository(Internacion).find({
          select: { id: true, pacienteId: true },
          where: { id: In(internacionIds) },
        })
      : [];

    const administraciones = administracionIds.length
      ? await this.administraciones
          .createQueryBuilder('a')
          .innerJoin('a.indicacion', 'im')
          .select('a.id', 'administrationId')
          .addSelect('im.paciente_id', 'pacienteId')
          .where('a.id IN (:...administracionIds)', { administracionIds })
          .getRawMany<{ administrationId: string; pacienteId: string }>()
      : [];

    const pacienteIds = [
      ...new Set([
        ...internaciones.map((internacion) => internacion.pacienteId),
        ...administraciones.map((administracion) => administracion.pacienteId),
      ]),
    ];

    const pacientes = pacienteIds.length
      ? await this.pacientes.find({
          select: { id: true, nombre: true, apellido: true, documento: true },
          where: { id: In(pacienteIds) },
        })
      : [];
    const porId = new Map(
      pacientes.map((paciente) => [paciente.id, this.aPacienteDetalle(paciente) as PacienteDetalle]),
    );

    const porInternacion = new Map<string, PacienteDetalle>();
    for (const internacion of internaciones) {
      const paciente = porId.get(internacion.pacienteId);
      if (paciente) porInternacion.set(internacion.id, paciente);
    }
    const porAdministracion = new Map<string, PacienteDetalle>();
    for (const administracion of administraciones) {
      const paciente = porId.get(administracion.pacienteId);
      if (paciente) porAdministracion.set(administracion.administrationId, paciente);
    }

    return { porInternacion, porAdministracion };
  }

  pagar(id: string): Promise<Cargo> {
    return this.changeState(id, (state) => state.pagar());
  }

  anular(id: string): Promise<Cargo> {
    return this.changeState(id, (state) => state.anular());
  }

  private changeState(
    id: string,
    transition: (state: CargoState) => CargoState,
  ): Promise<Cargo> {
    return this.cargos.manager.transaction((manager) =>
      this.changeStateLocked(manager, id, transition),
    );
  }

  private async changeStateLocked(
    manager: EntityManager,
    id: string,
    transition: (state: CargoState) => CargoState,
  ): Promise<Cargo> {
    const repository = manager.getRepository(Cargo);
    const cargo = await repository.findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });

    if (!cargo) {
      throw new NotFoundException('El cargo no existe.');
    }

    cargo.estado = this.nextEstado(cargo.estado, transition);
    return repository.save(cargo);
  }

  private nextEstado(
    current: EstadoCargo,
    transition: (state: CargoState) => CargoState,
  ): EstadoCargo {
    try {
      return transition(cargoStateFor(current)).estado;
    } catch (error) {
      if (error instanceof InvalidCargoTransitionError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
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
