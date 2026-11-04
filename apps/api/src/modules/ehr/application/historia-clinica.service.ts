import { Inject, Injectable } from '@nestjs/common';
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

  registrarEvolucion(pacienteId: string, nota: string, identity: SessionIdentity) {
    return this.registrar(pacienteId, CategoriaRegistro.EVOLUCION, null, nota, identity);
  }

  registrarEstudio(pacienteId: string, tipo: string, resultado: string, identity: SessionIdentity) {
    return this.registrar(pacienteId, CategoriaRegistro.ESTUDIO, tipo, resultado, identity);
  }

  private async registrar(
    pacienteId: string,
    categoria: CategoriaRegistro,
    titulo: string | null,
    detalle: string,
    identity: SessionIdentity,
  ): Promise<RegistroClinicoView> {
    await this.pacientes.get(pacienteId);
    const saved = await this.repository.create({
      pacienteId,
      registradoPorId: identity.accountId,
      categoria,
      titulo: titulo?.trim() ?? null,
      detalle: detalle.trim(),
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
    };
  }
}
