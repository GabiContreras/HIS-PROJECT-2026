import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EstadoTriaje, TriajeRegistro } from '../../../entities/triaje.entity.js';
import { EstadoCuenta, RolUsuario, Usuario } from '../../../entities/usuario.entity.js';
import { CrearTriageDto, NivelTriage } from '../api/dto/crear-triage.dto.js';
import type { TriageResponseDto } from '../api/dto/triage-response.dto.js';
import { NotificacionesService } from './notificaciones.service.js';
import { PacientesService } from './pacientes.service.js';

@Injectable()
export class TriageService {
  constructor(
    @InjectRepository(TriajeRegistro)
    private readonly triajeRepo: Repository<TriajeRegistro>,
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    private readonly pacientesService: PacientesService,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  async registrarTriage(dto: CrearTriageDto, registradoPorId: string): Promise<TriageResponseDto> {
    const paciente = await this.pacientesService.get(dto.pacienteId);

    if (dto.medicoDestinoId) {
      const medico = await this.usuarioRepo.findOneBy({
        id: dto.medicoDestinoId,
        rol: RolUsuario.MEDICO,
        estado: EstadoCuenta.ACTIVO,
      });
      if (!medico) throw new NotFoundException('No se encontró el médico destino.');
    }

    const registro = await this.triajeRepo.save(
      this.triajeRepo.create({
        pacienteId: dto.pacienteId,
        nivel: dto.nivel,
        motivoConsulta: dto.motivoConsulta,
        registradoPorId,
        medicoDestinoId: dto.medicoDestinoId ?? null,
      }),
    );

    if (dto.nivel === NivelTriage.ROJO) {
      const contenido = {
        tipo: 'TRIAGE_RIESGO_VITAL',
        prioridad: 'ALTA',
        mensaje: `¡ALTA PRIORIDAD! ${paciente.apellido}, ${paciente.nombre} ingresó por riesgo vital (Código Rojo) y requiere atención inmediata.`,
      };
      if (dto.medicoDestinoId) {
        await this.notificacionesService.notificarUsuarios([dto.medicoDestinoId], contenido);
      } else {
        await this.notificacionesService.notificarPorRol(RolUsuario.MEDICO, contenido);
      }
    }

    return this.aRespuesta(registro, `${paciente.apellido}, ${paciente.nombre}`);
  }

  async obtenerCola(): Promise<TriageResponseDto[]> {
    const registros = await this.triajeRepo
      .createQueryBuilder('t')
      .innerJoinAndSelect('t.paciente', 'p')
      .where('t.estado = :estado', { estado: EstadoTriaje.EN_COLA })
      .orderBy(
        `CASE t.nivel WHEN 'ROJO' THEN 1 WHEN 'NARANJA' THEN 2 WHEN 'AMARILLO' THEN 3 WHEN 'VERDE' THEN 4 ELSE 5 END`,
      )
      .addOrderBy('t.llegadaAt', 'ASC')
      .getMany();
    return registros.map((r) => this.aRespuesta(r, `${r.paciente.apellido}, ${r.paciente.nombre}`));
  }

  async atender(id: string): Promise<TriageResponseDto> {
    const registro = await this.triajeRepo.findOne({ where: { id }, relations: { paciente: true } });
    if (!registro) throw new NotFoundException('No se encontró el registro de triaje.');
    if (registro.estado === EstadoTriaje.ATENDIDO) {
      throw new ConflictException('El paciente ya fue atendido.');
    }
    registro.estado = EstadoTriaje.ATENDIDO;
    registro.atendidoAt = new Date();
    await this.triajeRepo.save(registro);
    return this.aRespuesta(registro, `${registro.paciente.apellido}, ${registro.paciente.nombre}`);
  }

  private aRespuesta(registro: TriajeRegistro, paciente: string): TriageResponseDto {
    return {
      id: registro.id,
      pacienteId: registro.pacienteId,
      paciente,
      motivo: registro.motivoConsulta,
      nivel: registro.nivel,
      estado: registro.estado,
      llegadaAt: registro.llegadaAt,
    };
  }
}
