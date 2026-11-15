import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { MedicationAdministered } from '../../../shared/events/medication-administered.event.js';
import { EstadoIndicacion, TipoIndicacion } from '../../../entities/indicacion-medica.entity.js';
import { ResultadoAdministracion } from '../../../entities/administracion-medicacion.entity.js';
import { PacientesService } from '../../admissions/application/pacientes.service.js';
import { HistoriaClinicaService } from '../../ehr/application/historia-clinica.service.js';
import type { SessionIdentity } from '../../iam/application/auth.service.js';
import type { ConfirmarAdministracionDto } from '../api/dto/confirmar-administracion.dto.js';
import type { CrearIndicacionDto } from '../api/dto/crear-indicacion.dto.js';
import type { CambiarIndicacionDto } from '../api/dto/cambiar-indicacion.dto.js';
import type { RegistrarEjecucionDto } from '../api/dto/registrar-ejecucion.dto.js';
import type { OmitirDosisDto } from '../api/dto/omitir-dosis.dto.js';
import {
  INDICACIONES_REPOSITORY,
  type AdministracionData,
  type IndicacionData,
  type IndicacionesRepository,
} from '../domain/ports/indicaciones.repository.js';
import {
  VENTANA_MINUTOS,
  dosisEnRango,
  evaluarAdministracion,
  indiceDeAdministracion,
  inicioDelDia,
  textoFrecuencia,
  type MotivoRechazo,
} from '../domain/medication-schedule.js';

export interface DosisView {
  programadaPara: string;
  estado: 'ADMINISTRADA' | 'OMITIDA' | 'PENDIENTE';
  /** True si la hora actual está dentro de la ventana de ±30 min de la dosis. */
  enVentana: boolean;
  administradaPor?: string;
  administradaEn?: string;
  motivoOmision?: string;
}

export interface IndicacionView {
  id: string;
  pacienteId: string;
  paciente: string;
  insumoId: string | null;
  insumo: string | null;
  tipo: TipoIndicacion;
  estado: EstadoIndicacion;
  internacionId: string | null;
  motivoSuspension: string | null;
  dosis: string;
  frecuencia: string;
  frecuenciaHoras: number | null;
  fechaInicio: string;
  fechaFin: string | null;
  dosisDelDia: DosisView[];
  alertasAlergia: string[];
}

export interface AdministracionView {
  id: string;
  indicacionId: string;
  pacienteId: string;
  insumoId: string | null;
  dosisProgramadaPara: string;
  administradaPor: string;
  administradaPorId: string;
  administradaEn: string;
  observaciones: string | null;
  resultado: 'ADMINISTRADA' | 'OMITIDA';
  motivoOmision: string | null;
}

const LIST_LIMIT = 100;
const DIA_MS = 24 * 60 * 60 * 1000;

const MENSAJES_RECHAZO: Record<MotivoRechazo, string> = {
  SIN_FRECUENCIA:
    'La indicación no tiene frecuencia estructurada (es anterior a la migración): el médico debe volver a indicarla.',
  NO_INICIADA: 'La indicación todavía no comenzó.',
  VENCIDA: 'La indicación está vencida.',
  FUERA_DE_VENTANA: `No hay una dosis programada dentro de ±${VENTANA_MINUTOS} minutos de este momento.`,
};

@Injectable()
export class IndicacionesService {
  constructor(
    @Inject(INDICACIONES_REPOSITORY)
    private readonly repository: IndicacionesRepository,
    private readonly pacientes: PacientesService,
    private readonly events: EventBus,
    private readonly historiaClinica: HistoriaClinicaService,
  ) {}

  async crear(dto: CrearIndicacionDto, identity: SessionIdentity): Promise<IndicacionView> {
    const ahora = new Date();
    const fechaFin = dto.fechaFin ? new Date(dto.fechaFin) : null;
    if (fechaFin && fechaFin <= ahora) {
      throw new BadRequestException('La fecha de fin debe ser posterior al momento actual.');
    }
    // Admisión es dueño de pacientes: se consulta por su caso de uso (404 si no existe).
    await this.pacientes.get(dto.pacienteId);
    const tipo = dto.tipo ?? TipoIndicacion.MEDICACION;
    if (tipo === TipoIndicacion.MEDICACION) {
      if (!dto.insumoId) throw new BadRequestException('La indicación MEDICACION requiere insumoId.');
      if (!(await this.repository.insumoExiste(dto.insumoId))) {
        throw new NotFoundException('No se encontró el insumo.');
      }
    } else if (dto.insumoId) {
      throw new BadRequestException('insumoId solo puede informarse para indicaciones MEDICACION.');
    }
    if (dto.internacionId && !(await this.repository.internacionPertenece(dto.internacionId, dto.pacienteId))) {
      throw new BadRequestException('La internación no pertenece al paciente indicado.');
    }

    const saved = await this.repository.create({
      pacienteId: dto.pacienteId,
      medicoId: identity.accountId,
      insumoId: dto.insumoId ?? null,
      tipo,
      internacionId: dto.internacionId ?? null,
      dosis: dto.dosis,
      frecuencia: textoFrecuencia(dto.frecuenciaHoras),
      frecuenciaHoras: dto.frecuenciaHoras,
      fechaFin,
    });
    const view = this.toView(saved, [], ahora);
    const nombreInsumo = saved.insumoId ? await this.repository.obtenerNombreInsumo(saved.insumoId) : null;
    return {
      ...view,
      alertasAlergia:
        tipo === TipoIndicacion.MEDICACION && nombreInsumo
          ? await this.historiaClinica.alertasAlergia(dto.pacienteId, nombreInsumo)
          : [],
    };
  }

  async listar(pacienteId?: string): Promise<IndicacionView[]> {
    const ahora = new Date();
    const desde = inicioDelDia(ahora);
    const rows = await this.repository.listarActivas(pacienteId, ahora, desde, LIST_LIMIT);
    return rows.map((row) => this.toView(row.indicacion, row.administraciones, ahora));
  }

  async administrar(
    indicacionId: string,
    dto: ConfirmarAdministracionDto,
    identity: SessionIdentity,
  ): Promise<AdministracionView> {
    let programadaPara = new Date(0);

    const { indicacion, administracion, creada } = await this.repository.administrarBajoBloqueo(indicacionId, (contexto) => {
      if (!contexto.indicacion) throw new NotFoundException('No se encontró la indicación.');
      const ahora = new Date();
      const plan = contexto.indicacion;
      if (plan.tipo !== TipoIndicacion.MEDICACION || !plan.insumoId) {
        throw new ConflictException('Solo las indicaciones MEDICACION admiten administración de dosis.');
      }
      if (plan.estado !== EstadoIndicacion.ACTIVA) throw new ConflictException('La indicación no está activa.');

      const evaluacion = evaluarAdministracion(plan, ahora);
      if (!evaluacion.ok) throw new ConflictException(MENSAJES_RECHAZO[evaluacion.motivo]);

      const previa = contexto.administraciones.find(
        (admin) => admin.dosisProgramadaPara?.getTime() === evaluacion.programadaPara.getTime(),
      ) ?? contexto.administraciones.find(
        (admin) =>
          admin.dosisProgramadaPara === null &&
          indiceDeAdministracion(plan, admin.fechaHoraAdministracion) === evaluacion.indice,
      );
      if (previa) {
        programadaPara = previa.dosisProgramadaPara ?? evaluacion.programadaPara;
        return { existente: previa };
      }

      programadaPara = evaluacion.programadaPara;
      return { nueva: {
        enfermeroId: identity.accountId,
        fechaHoraAdministracion: ahora,
        observaciones: dto.observaciones ?? null,
        dosisProgramadaPara: programadaPara,
        resultado: ResultadoAdministracion.ADMINISTRADA,
        motivoOmision: null,
      } };
    });

    if (creada) {
      this.events.publish(
        new MedicationAdministered({
          patientId: indicacion.pacienteId,
          supplyId: indicacion.insumoId!,
          quantity: 1,
          administeredBy: identity.accountId,
          administeredAt: administracion.fechaHoraAdministracion.toISOString(),
          administrationId: administracion.id,
        }),
      );
    }

    return this.toAdministracionView(indicacion, administracion, programadaPara);
  }

  async registrarEjecucion(
    indicacionId: string,
    dto: RegistrarEjecucionDto,
    identity: SessionIdentity,
  ): Promise<AdministracionView> {
    if (dto.resultado === ResultadoAdministracion.OMITIDA && !dto.motivoOmision?.trim()) {
      throw new BadRequestException('El motivo es obligatorio cuando la ejecución se omite.');
    }
    const { indicacion, administracion } = await this.repository.administrarBajoBloqueo(indicacionId, (contexto) => {
      if (!contexto.indicacion) throw new NotFoundException('No se encontró la indicación.');
      if (contexto.indicacion.tipo === TipoIndicacion.MEDICACION) {
        throw new ConflictException('Las indicaciones MEDICACION deben registrarse mediante el endpoint de dosis.');
      }
      if (contexto.indicacion.estado !== EstadoIndicacion.ACTIVA) {
        throw new ConflictException('La indicación no está activa.');
      }
      return { nueva: {
        enfermeroId: identity.accountId,
        fechaHoraAdministracion: new Date(),
        observaciones: dto.observaciones ?? null,
        dosisProgramadaPara: null,
        resultado: dto.resultado,
        motivoOmision: dto.motivoOmision?.trim() ?? null,
      } };
    });
    return this.toAdministracionView(indicacion, administracion);
  }

  async omitirDosis(
    indicacionId: string,
    dto: OmitirDosisDto,
    identity: SessionIdentity,
  ): Promise<AdministracionView> {
    let programadaPara = new Date(0);
    const { indicacion, administracion } = await this.repository.administrarBajoBloqueo(
      indicacionId,
      (contexto) => {
        if (!contexto.indicacion) throw new NotFoundException('No se encontró la indicación.');
        const plan = contexto.indicacion;
        if (plan.tipo !== TipoIndicacion.MEDICACION || !plan.insumoId) {
          throw new ConflictException('Solo las indicaciones MEDICACION tienen dosis programadas.');
        }
        if (plan.estado !== EstadoIndicacion.ACTIVA) throw new ConflictException('La indicación no está activa.');
        const evaluacion = evaluarAdministracion(plan, new Date());
        if (!evaluacion.ok) throw new ConflictException(MENSAJES_RECHAZO[evaluacion.motivo]);

        const previa = contexto.administraciones.find(
          (admin) =>
            admin.dosisProgramadaPara?.getTime() === evaluacion.programadaPara.getTime() ||
            (admin.dosisProgramadaPara === null &&
              indiceDeAdministracion(plan, admin.fechaHoraAdministracion) === evaluacion.indice),
        );
        if (previa) {
          if (previa.resultado !== ResultadoAdministracion.OMITIDA) {
            throw new ConflictException('La dosis programada ya fue administrada.');
          }
          programadaPara = previa.dosisProgramadaPara ?? evaluacion.programadaPara;
          return { existente: previa };
        }

        programadaPara = evaluacion.programadaPara;
        return {
          nueva: {
            enfermeroId: identity.accountId,
            fechaHoraAdministracion: new Date(),
            observaciones: dto.observaciones ?? null,
            dosisProgramadaPara: programadaPara,
            resultado: ResultadoAdministracion.OMITIDA,
            motivoOmision: dto.motivo.trim(),
          },
        };
      },
    );
    return this.toAdministracionView(indicacion, administracion, programadaPara);
  }

  async cambiarEstado(
    indicacionId: string,
    dto: CambiarIndicacionDto,
    identity: SessionIdentity,
  ): Promise<IndicacionView> {
    const indicacion = await this.repository.cambiarEstado(
      indicacionId,
      dto.estado,
      identity.accountId,
      dto.motivo.trim(),
    );
    if (!indicacion) throw new NotFoundException('No se encontró la indicación.');
    return this.toView(indicacion, [], new Date());
  }

  private toView(
    indicacion: IndicacionData,
    administraciones: AdministracionData[],
    ahora: Date,
  ): IndicacionView {
    const desde = inicioDelDia(ahora);
    const hasta = new Date(desde.getTime() + DIA_MS);
    const dosisDelDia: DosisView[] = dosisEnRango(indicacion, desde, hasta).map(({ indice, programadaPara }) => {
      const admin = administraciones.find(
        (a) =>
          a.dosisProgramadaPara?.getTime() === programadaPara.getTime() ||
          (a.dosisProgramadaPara === null &&
            indiceDeAdministracion(indicacion, a.fechaHoraAdministracion) === indice),
      );
      const enVentana = Math.abs(ahora.getTime() - programadaPara.getTime()) <= VENTANA_MINUTOS * 60_000;
      return {
        programadaPara: programadaPara.toISOString(),
        estado: admin?.resultado ?? 'PENDIENTE',
        enVentana,
        ...(admin
          ? { administradaPor: admin.enfermero, administradaEn: admin.fechaHoraAdministracion.toISOString() }
          : {}),
        ...(admin?.motivoOmision ? { motivoOmision: admin.motivoOmision } : {}),
      };
    });
    return {
      id: indicacion.id,
      pacienteId: indicacion.pacienteId,
      paciente: indicacion.paciente,
      insumoId: indicacion.insumoId,
      insumo: indicacion.insumo,
      tipo: indicacion.tipo as TipoIndicacion,
      estado: indicacion.estado as EstadoIndicacion,
      internacionId: indicacion.internacionId,
      motivoSuspension: indicacion.motivoSuspension,
      dosis: indicacion.dosis,
      frecuencia: indicacion.frecuencia,
      frecuenciaHoras: indicacion.frecuenciaHoras,
      fechaInicio: indicacion.fechaInicio.toISOString(),
      fechaFin: indicacion.fechaFin ? indicacion.fechaFin.toISOString() : null,
      dosisDelDia,
      alertasAlergia: [],
    };
  }

  private toAdministracionView(
    indicacion: IndicacionData,
    administracion: AdministracionData,
    programadaPara: Date | null = administracion.dosisProgramadaPara,
  ): AdministracionView {
    return {
      id: administracion.id,
      indicacionId: indicacion.id,
      pacienteId: indicacion.pacienteId,
      insumoId: indicacion.insumoId,
      dosisProgramadaPara: programadaPara?.toISOString() ?? '',
      administradaPor: administracion.enfermero,
      administradaPorId: administracion.enfermeroId,
      administradaEn: administracion.fechaHoraAdministracion.toISOString(),
      observaciones: administracion.observaciones,
      resultado: administracion.resultado,
      motivoOmision: administracion.motivoOmision,
    };
  }
}
