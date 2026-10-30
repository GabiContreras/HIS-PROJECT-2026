import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  IsNull,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { Cama } from '../../../entities/cama.entity.js';
import { Internacion } from '../../../entities/internacion.entity.js';
import { Paciente } from '../../../entities/paciente.entity.js';
import {
  EstadoCuenta,
  RolUsuario,
  Usuario,
} from '../../../entities/usuario.entity.js';
import { BedAssigned } from '../../../shared/events/bed-assigned.event.js';
import { BedCleaned } from '../../../shared/events/bed-cleaned.event.js';
import { BedReleased } from '../../../shared/events/bed-released.event.js';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import type { SessionIdentity } from '../../iam/application/auth.service.js';
import { AsignarCamaDto } from '../api/dto/asignar-cama.dto.js';
import { CamaResponseDto } from '../api/dto/cama-response.dto.js';
import { ListarCamasQueryDto } from '../api/dto/listar-camas-query.dto.js';
import { EstadoCama } from '../domain/estado-cama.enum.js';
import { InvalidBedTransitionError } from '../domain/invalid-bed-transition.error.js';
import { BedState } from '../domain/state/bed-state.js';
import { BedStateFactory } from '../domain/state/bed-state.factory.js';

@Injectable()
export class CamasService {
  private readonly logger = new Logger(CamasService.name);

  constructor(
    @InjectRepository(Cama) private readonly camas: Repository<Cama>,
    private readonly dataSource: DataSource,
    private readonly events: EventBus,
  ) {}


  async listar(query: ListarCamasQueryDto): Promise<CamaResponseDto[]> {
    const where: FindOptionsWhere<Cama> = {};
    if (query.estado) where.estado = query.estado;
    if (query.sector) where.sector = query.sector;

    const camas = await this.camas.find({
      where,
      relations: { pacienteActual: true },
      order: { sector: 'ASC', numero: 'ASC' },
    });
    return camas.map((cama) => this.toDto(cama));
  }

  async obtener(id: string): Promise<CamaResponseDto> {
    const cama = await this.camas.findOne({
      where: { id },
      relations: { pacienteActual: true },
    });
    if (!cama) throw new NotFoundException('La cama no existe.');
    return this.toDto(cama);
  }



  async asignar(
    camaId: string,
    dto: AsignarCamaDto,
    identity: SessionIdentity,
  ): Promise<CamaResponseDto> {
    const medicoId = this.resolverMedico(dto, identity);

    const { cama, internacion } = await this.enTransaccion(async (manager) => {
      // 1) Candado de fila: el segundo operador espera acá hasta que el primero termine.
      const cama = await this.bloquearCama(manager, camaId);


      if (cama.estado === EstadoCama.OCUPADA) {
        throw new ConflictException(
          `La cama ${cama.numero} ya fue ocupada por otro operador.`,
        );
      }

      const siguiente = this.transicionar((s) => s.ocupar(), cama);

      const medico = await manager.findOne(Usuario, {
        where: {
          id: medicoId,
          rol: RolUsuario.MEDICO,
          estado: EstadoCuenta.ACTIVO,
        },
      });
      if (!medico) {
        throw new BadRequestException(
          'El médico indicado no existe o no está habilitado.',
        );
      }

      const paciente = await manager.findOne(Paciente, {
        where: { id: dto.pacienteId },
      });
      if (!paciente) throw new NotFoundException('El paciente no existe.');

      const activas = await manager.count(Internacion, {
        where: { pacienteId: paciente.id, fechaEgreso: IsNull() },
      });
      if (activas > 0) {
        throw new ConflictException('El paciente ya tiene una internación activa.');
      }

      cama.estado = siguiente;
      cama.pacienteActual = paciente;
      await manager.save(Cama, cama);

      const internacion = await manager.save(
        Internacion,
        manager.create(Internacion, {
          pacienteId: paciente.id,
          camaId: cama.id,
          medicoId,
        }),
      );
      return { cama, internacion };
    });

    this.events.publish(
      new BedAssigned(
        {
          bedId: cama.id,
          bedNumber: cama.numero,
          patientId: dto.pacienteId,
          assignedAt: internacion.fechaIngreso.toISOString(),
        },
        internacion.id,
      ),
    );
    return this.toDto(cama);
  }


  async darAlta(camaId: string): Promise<CamaResponseDto> {
    const { cama, internacion } = await this.enTransaccion(async (manager) => {
      const cama = await this.bloquearCama(manager, camaId);
      const siguiente = this.transicionar((s) => s.darAlta(), cama); // OCUPADA -> EN_LIMPIEZA

      const activa = await manager
        .createQueryBuilder(Internacion, 'i')
        .setLock('pessimistic_write')
        .where('i.camaId = :camaId', { camaId })
        .andWhere('i.fechaEgreso IS NULL')
        .getOne();
      if (!activa) {
        throw new ConflictException(
          `La cama ${cama.numero} figura ocupada pero no tiene internación activa.`,
        );
      }

      await manager
        .createQueryBuilder()
        .update(Internacion)
        .set({ fechaEgreso: () => 'now()' })
        .where('id = :id', { id: activa.id })
        .execute();

      cama.estado = siguiente;
      cama.pacienteActual = null;
      await manager.save(Cama, cama);
      return { cama, internacion: activa };
    });

    this.events.publish(
      new BedReleased(
        {
          bedId: cama.id,
          bedNumber: cama.numero,
          patientId: internacion.pacienteId,
          admissionId: internacion.id,
          releasedAt: new Date().toISOString(),
        },
        internacion.id,
      ),
    );
    return this.toDto(cama);
  }

  async confirmarLimpieza(camaId: string): Promise<CamaResponseDto> {
    const cama = await this.cambiarEstado(camaId, (s) => s.confirmarLimpieza());
    this.events.publish(
      new BedCleaned({
        bedId: cama.id,
        bedNumber: cama.numero,
        cleanedAt: new Date().toISOString(),
      }),
    );
    return this.toDto(cama);
  }

  async bloquear(camaId: string): Promise<CamaResponseDto> {
    return this.toDto(await this.cambiarEstado(camaId, (s) => s.bloquear()));
  }

  async desbloquear(camaId: string): Promise<CamaResponseDto> {
    return this.toDto(await this.cambiarEstado(camaId, (s) => s.desbloquear()));
  }


  private resolverMedico(dto: AsignarCamaDto, identity: SessionIdentity): string {
    if (identity.rol === RolUsuario.MEDICO) return identity.accountId;
    if (!dto.medicoId) {
      throw new BadRequestException(
        'Indicá el médico responsable (medicoId) para internar al paciente.',
      );
    }
    return dto.medicoId;
  }

  private async cambiarEstado(
    camaId: string,
    accion: (s: BedState) => EstadoCama,
  ): Promise<Cama> {
    return this.enTransaccion(async (manager) => {
      const cama = await this.bloquearCama(manager, camaId);
      cama.estado = this.transicionar(accion, cama);
      await manager.save(Cama, cama);
      return cama;
    });
  }

  private async bloquearCama(manager: EntityManager, id: string): Promise<Cama> {
    await manager.query(`SET LOCAL lock_timeout = '5s'`);
    const cama = await manager
      .createQueryBuilder(Cama, 'c')
      .setLock('pessimistic_write')
      .where('c.id = :id', { id })
      .getOne();
    if (!cama) throw new NotFoundException('La cama no existe.');
    return cama;
  }

  /** Aplica la máquina de estados y traduce el error de dominio a 409. */
  private transicionar(
    accion: (s: BedState) => EstadoCama,
    cama: Cama,
  ): EstadoCama {
    try {
      return accion(BedStateFactory.from(cama.estado));
    } catch (error) {
      if (error instanceof InvalidBedTransitionError) {
        throw new ConflictException(`Cama ${cama.numero}: ${error.message}`);
      }
      throw error;
    }
  }

  private async enTransaccion<T>(
    trabajo: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.dataSource.transaction(trabajo);
    } catch (error) {
      throw this.traducirError(error);
    }
  }

  private traducirError(error: unknown): unknown {
    if (error instanceof QueryFailedError) {
      const driver = (
        error as QueryFailedError & {
          driverError?: { code?: string; constraint?: string };
        }
      ).driverError;

      if (driver?.code === '23505') {
        if (driver.constraint === 'uq_camas_paciente_actual') {
          return new ConflictException('El paciente ya tiene una internación activa.');
        }
        return new ConflictException('La cama ya fue ocupada por otro operador.');
      }
      if (driver?.code === '55P03') {
        return new ConflictException(
          'La cama está siendo modificada por otro operador. Reintentá en unos segundos.',
        );
      }
      this.logger.error(`Error de base de datos: ${driver?.code ?? 's/c'}`, error.stack);
    }
    return error;
  }

  private toDto(cama: Cama): CamaResponseDto {
    const p = cama.pacienteActual ?? null;
    return {
      id: cama.id,
      numero: cama.numero,
      sector: cama.sector ?? null,
      estado: cama.estado,
      paciente: p
        ? { id: p.id, nombre: p.nombre, apellido: p.apellido, documento: p.documento }
        : null,
      version: cama.version,
    };
  }
}