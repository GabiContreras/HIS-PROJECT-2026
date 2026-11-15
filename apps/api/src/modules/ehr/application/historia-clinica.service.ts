import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PacientesService } from '../../admissions/application/pacientes.service.js';
import type { PacienteData } from '../../admissions/domain/ports/pacientes.repository.js';
import type { SessionIdentity } from '../../iam/application/auth.service.js';
import {
  HISTORIA_CLINICA_REPOSITORY,
  type HistoriaClinicaRepository,
  type RegistroClinicoData,
} from '../domain/ports/historia-clinica.repository.js';
import {
  CategoriaRegistro,
  armarHistoria,
  type Historia,
  type RegistroClinicoView,
} from '../domain/registro-clinico.js';

export interface HistoriaClinicaView extends Historia {
  /** Ficha demográfica, tomada de Admisión. */
  paciente: PacienteData;
}

export interface TimelineView {
  id: string;
  tipo: string;
  fechaHora: string;
  titulo: string;
  detalle: string;
}

@Injectable()
export class HistoriaClinicaService {
  constructor(
    @Inject(HISTORIA_CLINICA_REPOSITORY)
    private readonly repository: HistoriaClinicaRepository,
    private readonly pacientes: PacientesService,
  ) {}

  async obtener(pacienteId: string): Promise<HistoriaClinicaView> {
    // Admisión es dueño de pacientes: se consulta por su caso de uso (404 si no existe).
    const paciente = await this.pacientes.get(pacienteId);
    const rows = await this.repository.listByPaciente(pacienteId);
    return { paciente, ...armarHistoria(rows.map((row) => this.toView(row))) };
  }

  registrarAlergia(pacienteId: string, sustancia: string, reaccion: string, identity: SessionIdentity) {
    return this.registrar(pacienteId, CategoriaRegistro.ALERGIA, sustancia, reaccion, identity);
  }

  registrarAntecedenteFamiliar(pacienteId: string, parentesco: string, descripcion: string, identity: SessionIdentity) {
    return this.registrar(pacienteId, CategoriaRegistro.ANTECEDENTE_FAMILIAR, parentesco, descripcion, identity);
  }

  registrarEvolucion(
    pacienteId: string,
    nota: string,
    identity: SessionIdentity,
    turnoId?: string,
    internacionId?: string,
  ) {
    return this.registrar(pacienteId, CategoriaRegistro.EVOLUCION, null, nota, identity, {
      turnoId,
      internacionId,
    });
  }

  registrarEstudio(pacienteId: string, tipo: string, resultado: string, identity: SessionIdentity) {
    return this.registrar(pacienteId, CategoriaRegistro.ESTUDIO, tipo, resultado, identity);
  }

  /** Nota de enfermería automática: la registra Enfermería (HU 1.1) y queda en la historia clínica del paciente. */
  registrarNotaEnfermeria(pacienteId: string, titulo: string, detalle: string, identity: SessionIdentity) {
    return this.registrar(pacienteId, CategoriaRegistro.NOTA_ENFERMERIA, titulo, detalle, identity);
  }

  async rectificar(
    pacienteId: string,
    registroId: string,
    motivo: string,
    identity: SessionIdentity,
  ): Promise<RegistroClinicoView> {
    const original = await this.repository.getByPacienteAndId(pacienteId, registroId);
    if (!original) throw new NotFoundException('No se encontró el registro clínico.');
    if (original.rectificado) {
      throw new ConflictException('El registro clínico ya fue rectificado.');
    }
    return this.registrar(
      pacienteId,
      CategoriaRegistro.RECTIFICACION,
      'Rectificación de registro clínico',
      motivo,
      identity,
      { corrigeA: registroId },
    );
  }

  async timeline(pacienteId: string): Promise<TimelineView[]> {
    await this.pacientes.get(pacienteId);
    const rows = await this.repository.timeline(pacienteId);
    return rows.map((row) => ({ ...row, fechaHora: row.fechaHora.toISOString() }));
  }

  async alertasAlergia(pacienteId: string, insumo: string): Promise<string[]> {
    const rows = await this.repository.listByPaciente(pacienteId);
    const normalizar = (value: string) =>
      value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    const nombre = normalizar(insumo);
    if (!nombre) return [];
    return rows
      .filter(
        (row) =>
          row.categoria === CategoriaRegistro.ALERGIA &&
          (normalizar(row.titulo ?? '').includes(nombre) || nombre.includes(normalizar(row.titulo ?? ''))),
      )
      .map((row) => row.titulo ?? 'Alergia registrada');
  }

  async alergias(pacienteId: string): Promise<RegistroClinicoView[]> {
    await this.pacientes.get(pacienteId);
    const rows = await this.repository.listByPaciente(pacienteId);
    return rows
      .filter((row) => row.categoria === CategoriaRegistro.ALERGIA)
      .map((row) => this.toView(row));
  }

  private async registrar(
    pacienteId: string,
    categoria: CategoriaRegistro,
    titulo: string | null,
    detalle: string,
    identity: SessionIdentity,
    context: { corrigeA?: string; turnoId?: string; internacionId?: string } = {},
  ): Promise<RegistroClinicoView> {
    await this.pacientes.get(pacienteId);
    if (!(await this.repository.validarContexto(pacienteId, context.turnoId, context.internacionId))) {
      throw new BadRequestException('El turno o la internación no pertenecen al paciente.');
    }
    const saved = await this.repository.create({
      pacienteId,
      registradoPorId: identity.accountId,
      categoria,
      titulo: titulo?.trim() ?? null,
      detalle: detalle.trim(),
      ...(context.corrigeA ? { corrigeA: context.corrigeA } : {}),
      ...(context.turnoId ? { turnoId: context.turnoId } : {}),
      ...(context.internacionId ? { internacionId: context.internacionId } : {}),
    });
    return this.toView(saved);
  }

  private toView(row: RegistroClinicoData): RegistroClinicoView {
    return {
      id: row.id,
      categoria: row.categoria as CategoriaRegistro,
      titulo: row.titulo,
      detalle: row.detalle,
      registradoPor: row.registradoPor,
      fechaHora: row.fechaHora.toISOString(),
      corrigeA: row.corrigeA,
      rectificado: row.rectificado,
      turnoId: row.turnoId,
      internacionId: row.internacionId,
    };
  }
}
