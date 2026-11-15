import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Repository } from 'typeorm';
import { Estudio, EstadoEstudio } from '../../../entities/estudio.entity.js';
import { PacientesService } from '../../admissions/application/pacientes.service.js';
import type { SessionIdentity } from '../../iam/application/auth.service.js';
import type { CrearEstudioDto } from '../api/dto/crear-estudio.dto.js';

export const MAX_ESTUDIO_ADJUNTO_BYTES = 10 * 1024 * 1024;
const TIPOS_PERMITIDOS = new Set(['application/pdf', 'image/jpeg', 'image/png']);

export interface ArchivoEstudio {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

@Injectable()
export class EstudiosService {
  private readonly storagePath = path.resolve(process.env.EHR_STORAGE_DIR ?? 'var/ehr-attachments');

  constructor(
    @InjectRepository(Estudio) private readonly estudios: Repository<Estudio>,
    private readonly pacientes: PacientesService,
  ) {}

  async listar(pacienteId: string) {
    await this.pacientes.get(pacienteId);
    const rows = await this.estudios.find({
      where: { paciente: { id: pacienteId } },
      relations: { solicitante: true },
      order: { fecha: 'DESC' },
    });
    return rows.map((row) => this.toView(row));
  }

  async crear(pacienteId: string, dto: CrearEstudioDto, archivo: ArchivoEstudio, identity: SessionIdentity) {
    await this.pacientes.get(pacienteId);
    this.validarAdjunto(archivo);
    const storageKey = randomUUID();
    const destino = path.join(this.storagePath, storageKey);
    await mkdir(this.storagePath, { recursive: true });
    await writeFile(destino, archivo.buffer, { flag: 'wx' });
    try {
      const saved = await this.estudios.save(
        this.estudios.create({
          paciente: { id: pacienteId },
          tipo: dto.tipo.trim(),
          fecha: dto.fecha ? new Date(dto.fecha) : new Date(),
          estado: dto.estado ?? EstadoEstudio.INFORMADO,
          informe: dto.informe.trim(),
          solicitante: { id: identity.accountId },
          storageKey,
          nombreAdjunto: path.basename(archivo.originalname).slice(0, 255),
          mediaType: archivo.mimetype,
          tamanoBytes: String(archivo.size),
        }),
      );
      const row = await this.estudios.findOneOrFail({
        where: { id: saved.id },
        relations: { paciente: true, solicitante: true },
      });
      return this.toView(row);
    } catch (error) {
      await rm(destino);
      throw error;
    }
  }

  async obtenerAdjunto(estudioId: string) {
    const estudio = await this.estudios.findOne({ where: { id: estudioId } });
    if (!estudio) throw new NotFoundException('No se encontró el estudio.');
    const filePath = path.join(this.storagePath, estudio.storageKey);
    if (path.dirname(filePath) !== this.storagePath) {
      throw new BadRequestException('La referencia al adjunto del estudio no es válida.');
    }
    return {
      buffer: await readFile(filePath),
      mediaType: estudio.mediaType,
      nombre: estudio.nombreAdjunto,
    };
  }

  private validarAdjunto(archivo: ArchivoEstudio): void {
    if (!archivo || !Buffer.isBuffer(archivo.buffer) || archivo.size === 0) {
      throw new BadRequestException('Debe adjuntar un archivo PDF o una imagen PNG/JPEG.');
    }
    if (archivo.size > MAX_ESTUDIO_ADJUNTO_BYTES) {
      throw new BadRequestException('El adjunto no puede superar los 10 MB.');
    }
    if (!TIPOS_PERMITIDOS.has(archivo.mimetype) || archivo.size !== archivo.buffer.length) {
      throw new BadRequestException('Tipo o tamaño de adjunto no permitido.');
    }
    const signatureMatches =
      (archivo.mimetype === 'application/pdf' && archivo.buffer.subarray(0, 5).toString() === '%PDF-') ||
      (archivo.mimetype === 'image/png' && archivo.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      (archivo.mimetype === 'image/jpeg' &&
        archivo.buffer[0] === 0xff &&
        archivo.buffer[1] === 0xd8 &&
        archivo.buffer[2] === 0xff);
    if (!signatureMatches) throw new BadRequestException('El contenido no coincide con el tipo declarado.');
  }

  private toView(row: Estudio) {
    return {
      id: row.id,
      pacienteId: row.paciente?.id,
      tipo: row.tipo,
      fecha: row.fecha.toISOString(),
      estado: row.estado,
      informe: row.informe,
      solicitanteId: row.solicitante?.id,
      nombreAdjunto: row.nombreAdjunto,
      mediaType: row.mediaType,
      tamanoBytes: Number(row.tamanoBytes),
      urlAdjunto: `/historia-clinica/estudios/${row.id}/adjunto`,
    };
  }
}
