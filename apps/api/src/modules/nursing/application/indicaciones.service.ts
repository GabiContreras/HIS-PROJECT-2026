import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { MedicationAdministered } from '../../../shared/events/medication-administered.event.js';
import { PacientesService } from '../../admissions/application/pacientes.service.js';
import type { SessionIdentity } from '../../iam/application/auth.service.js';
import type { ConfirmarAdministracionDto } from '../api/dto/confirmar-administracion.dto.js';
import type { CrearIndicacionDto } from '../api/dto/crear-indicacion.dto.js';
import {
  INDICACIONES_REPOSITORY,
  type AdministracionData,
  type IndicacionData,
  type IndicacionesRepository,
} from '../domain/ports/indicaciones.repository.js';
import {
  VENTANA_MINUTOS,
  dosisEnRango,
  dosisYaAdministrada,
  evaluarAdministracion,
  indiceDeAdministracion,
  inicioDelDia,
  textoFrecuencia,
  type MotivoRechazo,
} from '../domain/medication-schedule.js';

export interface DosisView {
  programadaPara: string;
  estado: 'ADMINISTRADA' | 'PENDIENTE';
  /** True si la hora actual está dentro de la ventana de ±30 min de la dosis. */
  enVentana: boolean;
  administradaPor?: string;
  administradaEn?: string;
}

export interface IndicacionView {
  id: string;
  pacienteId: string;
  paciente: string;
  insumoId: string;
  insumo: string;
  dosis: string;
  frecuencia: string;
  frecuenciaHoras: number | null;
  fechaInicio: string;
  fechaFin: string | null;
  dosisDelDia: DosisView[];
}

export interface AdministracionView {
  id: string;
  indicacionId: string;
  pacienteId: string;
  insumoId: string;
  dosisProgramadaPara: string;
  administradaPor: string;
  administradaPorId: string;
  administradaEn: string;
  observaciones: string | null;
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
  ) {}

  async crear(dto: CrearIndicacionDto, identity: SessionIdentity): Promise<IndicacionView> {
    const ahora = new Date();
    const fechaFin = dto.fechaFin ? new Date(dto.fechaFin) : null;
    if (fechaFin && fechaFin <= ahora) {
      throw new BadRequestException('La fecha de fin debe ser posterior al momento actual.');
    }
    // Admisión es dueño de pacientes: se consulta por su caso de uso (404 si no existe).
    await this.pacientes.get(dto.pacienteId);
    if (!(await this.repository.insumoExiste(dto.insumoId))) {
      throw new NotFoundException('No se encontró el insumo.');
    }

    const saved = await this.repository.create({
      pacienteId: dto.pacienteId,
      medicoId: identity.accountId,
      insumoId: dto.insumoId,
      dosis: dto.dosis,
      frecuencia: textoFrecuencia(dto.frecuenciaHoras),
      frecuenciaHoras: dto.frecuenciaHoras,
      fechaFin,
    });
    return this.toView(saved, [], ahora);
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

    const { indicacion, administracion } = await this.repository.administrarBajoBloqueo(indicacionId, (contexto) => {
      if (!contexto.indicacion) throw new NotFoundException('No se encontró la indicación.');
      const ahora = new Date();
      const plan = contexto.indicacion;

      const evaluacion = evaluarAdministracion(plan, ahora);
      if (!evaluacion.ok) throw new ConflictException(MENSAJES_RECHAZO[evaluacion.motivo]);

      const previas = contexto.administraciones.map((admin) => admin.fechaHoraAdministracion);
      if (dosisYaAdministrada(plan, evaluacion.indice, previas)) {
        throw new ConflictException(
          `La dosis de las ${evaluacion.programadaPara.toISOString()} ya fue administrada.`,
        );
      }

      programadaPara = evaluacion.programadaPara;
      return {
        enfermeroId: identity.accountId,
        fechaHoraAdministracion: ahora,
        observaciones: dto.observaciones ?? null,
      };
    });

    // El evento se publica recién cuando la transacción ya está confirmada.
    this.events.publish(
      new MedicationAdministered({
        patientId: indicacion.pacienteId,
        supplyId: indicacion.insumoId,
        quantity: 1,
        administeredBy: identity.accountId,
        administeredAt: administracion.fechaHoraAdministracion.toISOString(),
        administrationId: administracion.id,
      }),
    );

    return {
      id: administracion.id,
      indicacionId: indicacion.id,
      pacienteId: indicacion.pacienteId,
      insumoId: indicacion.insumoId,
      dosisProgramadaPara: programadaPara.toISOString(),
      administradaPor: administracion.enfermero,
      administradaPorId: administracion.enfermeroId,
      administradaEn: administracion.fechaHoraAdministracion.toISOString(),
      observaciones: administracion.observaciones,
    };
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
        (a) => indiceDeAdministracion(indicacion, a.fechaHoraAdministracion) === indice,
      );
      const enVentana = Math.abs(ahora.getTime() - programadaPara.getTime()) <= VENTANA_MINUTOS * 60_000;
      return {
        programadaPara: programadaPara.toISOString(),
        estado: admin ? 'ADMINISTRADA' : 'PENDIENTE',
        enVentana,
        ...(admin
          ? { administradaPor: admin.enfermero, administradaEn: admin.fechaHoraAdministracion.toISOString() }
          : {}),
      };
    });
    return {
      id: indicacion.id,
      pacienteId: indicacion.pacienteId,
      paciente: indicacion.paciente,
      insumoId: indicacion.insumoId,
      insumo: indicacion.insumo,
      dosis: indicacion.dosis,
      frecuencia: indicacion.frecuencia,
      frecuenciaHoras: indicacion.frecuenciaHoras,
      fechaInicio: indicacion.fechaInicio.toISOString(),
      fechaFin: indicacion.fechaFin ? indicacion.fechaFin.toISOString() : null,
      dosisDelDia,
    };
  }
}
