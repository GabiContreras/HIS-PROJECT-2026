import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auditoria } from '../../../entities/auditoria.entity.js';

export interface NuevaAuditoria {
  usuarioId: string | null;
  accion: string;
  recurso: string;
  pacienteId: string | null;
  metodo: string;
  ruta: string;
  estadoHttp: number;
  ip: string | null;
  detalle: string | null;
}

@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(
    @InjectRepository(Auditoria)
    private readonly registros: Repository<Auditoria>,
  ) {}

  async registrar(data: NuevaAuditoria): Promise<void> {
    try {
      await this.registros.insert(data);
    } catch (error) {
      this.logger.error(
        `No se pudo registrar la auditoría de ${data.accion}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}