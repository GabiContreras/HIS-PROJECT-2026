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
import { Habitacion } from '../../../entities/habitacion.entity.js';
import { Sector } from '../../../entities/sector.entity.js';
import {
  EstadoCuenta,
  RolUsuario,
  Usuario,
} from '../../../entities/usuario.entity.js';
import { BedAssigned } from '../../../shared/events/bed-assigned.event.js';
import { BedCleaned } from '../../../shared/events/bed-cleaned.event.js';
import { BedReleased } from '../../../shared/events/bed-released.event.js';
import { BedTransferred } from '../../../shared/events/bed-transferred.event.js';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { PatientAdmitted } from '../../../shared/events/patient-admitted.event.js';
import type { SessionIdentity } from '../../iam/application/auth.service.js';
import { AsignarCamaDto } from '../api/dto/asignar-cama.dto.js';
import { CrearCamaDto } from '../api/dto/crear-cama.dto.js';
import { ActualizarCamaDto } from '../api/dto/actualizar-cama.dto.js';
import { BloquearCamaDto } from '../api/dto/bloquear-cama.dto.js';
import { InternacionesFiltroDto } from '../api/dto/internaciones-filtro.dto.js';
import { CrearSectorDto } from '../api/dto/crear-sector.dto.js';
import { CrearHabitacionDto } from '../api/dto/crear-habitacion.dto.js';
import { CamaResponseDto } from '../api/dto/cama-response.dto.js';
import { ListarCamasQueryDto } from '../api/dto/listar-camas-query.dto.js';
import { BED_BLOCKED, BED_UNBLOCKED, type BedBlockedPayload, type BedUnblockedPayload } from '../domain/bed-events.js';
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
    const where: FindOptionsWhere<Cama> = { activo: true };
    if (query.estado) where.estado = query.estado;
    if (query.sector) where.sector = query.sector;
    if (query.habitacionId) where.habitacion = { id: query.habitacionId };

    const camas = await this.camas.find({
      where,
      relations: { pacienteActual: true, habitacion: { sector: true } },
      order: { sector: 'ASC', numero: 'ASC' },
    });
    return camas.map((cama) => this.toDto(cama));
  }

  async obtener(id: string): Promise<CamaResponseDto> {
    const cama = await this.camas.findOne({
      where: { id },
      relations: { pacienteActual: true, habitacion: { sector: true } },
    });
    if (!cama) throw new NotFoundException('La cama no existe.');
    return this.toDto(cama);
  }

  async crear(dto: CrearCamaDto): Promise<CamaResponseDto> {
    const cama = await this.enTransaccion(async (manager) => {
      const habitacion = await manager.findOne(Habitacion, {
        where: { id: dto.habitacionId, activo: true, sector: { activo: true } },
        relations: { sector: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!habitacion) throw new NotFoundException('La habitación no existe o está inactiva.');
      const cantidad = await manager.count(Cama, { where: { habitacion: { id: habitacion.id }, activo: true } });
      if (cantidad >= habitacion.capacidad) throw new ConflictException('La habitación alcanzó su capacidad máxima.');
      const repo = manager.getRepository(Cama);
      return repo.save(
        repo.create({
          numero: dto.numero.trim(),
          sector: habitacion.sector.nombre,
          habitacion,
          estado: EstadoCama.LIBRE,
          activo: true,
          pacienteActual: null,
          motivoBloqueo: null,
        }),
      );
    });
    return this.toDto(await this.cargarCama(cama.id));
  }

  async actualizar(camaId: string, dto: ActualizarCamaDto): Promise<CamaResponseDto> {
    if (dto.numero === undefined && dto.habitacionId === undefined) {
      throw new BadRequestException('Debe informar al menos un campo para actualizar.');
    }
    const cama = await this.enTransaccion(async (manager) => {
      const existente = await this.bloquearCama(manager, camaId);
      if (existente.estado !== EstadoCama.LIBRE) {
        throw new ConflictException('Solo se puede editar una cama libre.');
      }
      if (dto.habitacionId) {
        const habitacion = await manager.findOne(Habitacion, {
          where: { id: dto.habitacionId, activo: true, sector: { activo: true } },
          relations: { sector: true },
          lock: { mode: 'pessimistic_write' },
        });
        if (!habitacion) throw new NotFoundException('La habitación no existe o está inactiva.');
        const cantidad = await manager.count(Cama, {
          where: { habitacion: { id: habitacion.id }, activo: true },
        });
        const yaPertenece = existente.habitacion?.id === habitacion.id;
        if (!yaPertenece && cantidad >= habitacion.capacidad) {
          throw new ConflictException('La habitación alcanzó su capacidad máxima.');
        }
        existente.habitacion = habitacion;
        existente.sector = habitacion.sector.nombre;
      }
      if (dto.numero !== undefined) existente.numero = dto.numero.trim();
      return manager.save(Cama, existente);
    });
    return this.toDto(await this.cargarCama(cama.id));
  }

  async darDeBaja(camaId: string): Promise<CamaResponseDto> {
    const cama = await this.enTransaccion(async (manager) => {
      const existente = await this.bloquearCama(manager, camaId);
      if (existente.estado !== EstadoCama.LIBRE || existente.pacienteActual) {
        throw new ConflictException('Solo se puede dar de baja una cama libre y sin paciente asignado.');
      }
      existente.activo = false;
      return manager.save(Cama, existente);
    });
    return this.toDto(await this.cargarCama(cama.id));
  }

  listarSectores() {
    return this.dataSource.getRepository(Sector).find({ where: { activo: true }, order: { nombre: 'ASC' } });
  }

  async crearSector(dto: CrearSectorDto) {
    const repo = this.dataSource.getRepository(Sector);
    if (await repo.exists({ where: { nombre: dto.nombre.trim() } })) {
      throw new ConflictException('Ya existe un sector con ese nombre.');
    }
    return repo.save(repo.create({ nombre: dto.nombre.trim(), activo: true }));
  }

  listarHabitaciones(sectorId?: string) {
    return this.dataSource.getRepository(Habitacion).find({
      where: { activo: true, ...(sectorId ? { sector: { id: sectorId } } : {}) },
      relations: { sector: true },
      order: { sector: { nombre: 'ASC' }, numero: 'ASC' },
    });
  }

  async crearHabitacion(dto: CrearHabitacionDto) {
    return this.enTransaccion(async (manager) => {
      const sector = await manager.findOne(Sector, {
        where: { id: dto.sectorId, activo: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!sector) throw new NotFoundException('El sector no existe o está inactivo.');
      const repo = manager.getRepository(Habitacion);
      return repo.save(
        repo.create({
          sector,
          numero: dto.numero.trim(),
          capacidad: dto.capacidad,
          activo: true,
        }),
      );
    });
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
          motivoIngreso: dto.motivoIngreso ?? null,
        }),
      );
      return { cama, internacion };
    });

    this.events.publish(
      new BedAssigned(
        {
          bedId: cama.id,
          camaId: cama.id,
          bedNumber: cama.numero,
          patientId: dto.pacienteId,
          assignedAt: internacion.fechaIngreso.toISOString(),
          internacionId: internacion.id,
          fechaIngreso: internacion.fechaIngreso.toISOString(),
          fechaEgreso: null,
        },
        internacion.id,
      ),
    );

    // HU 2.1 de Enfermería: el ingreso dispara el protocolo de atención. Se publica después del commit
    // y solo si se informó el motivo; sin motivo no hay protocolo que elegir.
    if (internacion.motivoIngreso) {
      this.events.publish(
        new PatientAdmitted(
          {
            admissionId: internacion.id,
            patientId: dto.pacienteId,
            reason: internacion.motivoIngreso,
            admittedAt: internacion.fechaIngreso.toISOString(),
          },
          internacion.id,
        ),
      );
    }
    return this.toDto(await this.cargarCama(cama.id));
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
          camaId: cama.id,
          bedNumber: cama.numero,
          patientId: internacion.pacienteId,
          admissionId: internacion.id,
          releasedAt: new Date().toISOString(),
          internacionId: internacion.id,
          fechaIngreso: internacion.fechaIngreso.toISOString(),
          fechaEgreso: new Date().toISOString(),
        },
        internacion.id,
      ),
    );
    return this.toDto(await this.cargarCama(cama.id));
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
    return this.toDto(await this.cargarCama(cama.id));
  }

  async bloquear(camaId: string, dto: BloquearCamaDto): Promise<CamaResponseDto> {
    const cama = await this.cambiarEstado(camaId, (s) => s.bloquear(), (row) => {
      row.motivoBloqueo = dto.motivo.trim();
    });
    const blockedAt = new Date().toISOString();
    this.events.publish<BedBlockedPayload>({
      type: BED_BLOCKED,
      occurredAt: blockedAt,
      payload: { bedId: cama.id, bedNumber: cama.numero, blockedAt },
    });
    return this.toDto(await this.cargarCama(cama.id));
  }

  async desbloquear(camaId: string): Promise<CamaResponseDto> {
    const cama = await this.cambiarEstado(camaId, (s) => s.desbloquear(), (row) => {
      row.motivoBloqueo = null;
    });
    const unblockedAt = new Date().toISOString();
    this.events.publish<BedUnblockedPayload>({
      type: BED_UNBLOCKED,
      occurredAt: unblockedAt,
      payload: { bedId: cama.id, bedNumber: cama.numero, unblockedAt },
    });
    return this.toDto(await this.cargarCama(cama.id));
  }

  async trasladar(camaOrigenId: string, camaDestinoId: string): Promise<CamaResponseDto> {
    if (camaOrigenId === camaDestinoId) throw new BadRequestException('La cama de destino debe ser distinta.');
    const traslado = await this.enTransaccion(async (manager) => {
      const ids = [camaOrigenId, camaDestinoId].sort();
      const camas = new Map<string, Cama>();
      for (const id of ids) camas.set(id, await this.bloquearCama(manager, id));
      const origen = camas.get(camaOrigenId)!;
      const destino = camas.get(camaDestinoId)!;
      if (destino.estado !== EstadoCama.LIBRE) {
        throw new ConflictException('La cama de destino debe estar LIBRE.');
      }
      const internacionDestino = await manager.findOne(Internacion, {
        where: { camaId: destino.id, fechaEgreso: IsNull() },
      });
      if (internacionDestino) {
        throw new ConflictException('La cama de destino ya tiene una internación activa.');
      }
      if (origen.estado !== EstadoCama.OCUPADA) {
        throw new ConflictException('La cama de origen debe estar OCUPADA.');
      }
      const internacion = await manager.findOne(Internacion, {
        where: { camaId: origen.id, fechaEgreso: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!internacion) throw new ConflictException('No existe una internación activa para la cama de origen.');
      const paciente = await manager.findOne(Paciente, { where: { id: internacion.pacienteId } });
      if (!paciente) throw new NotFoundException('No se encontró el paciente de la internación activa.');
      origen.estado = this.transicionar((s) => s.darAlta(), origen);
      origen.pacienteActual = null;
      destino.estado = this.transicionar((s) => s.ocupar(), destino);
      destino.pacienteActual = paciente;
      internacion.camaId = destino.id;
      await manager.save(Cama, [origen, destino]);
      await manager.save(Internacion, internacion);
      return {
        destino,
        origenNumero: origen.numero,
        destinoNumero: destino.numero,
        internacion,
      };
    });
    const trasladadoEn = new Date().toISOString();
    this.events.publish(
      new BedTransferred(
        {
          internacionId: traslado.internacion.id,
          patientId: traslado.internacion.pacienteId,
          camaOrigenId,
          camaDestinoId,
          camaOrigenNumero: traslado.origenNumero,
          camaDestinoNumero: traslado.destinoNumero,
          fechaIngreso: traslado.internacion.fechaIngreso.toISOString(),
          fechaEgreso: null,
          trasladadoEn,
        },
        traslado.internacion.id,
      ),
    );
    return this.toDto(await this.cargarCama(traslado.destino.id));
  }

  async listarInternaciones(query: InternacionesFiltroDto) {
    const rows = await this.dataSource.getRepository(Internacion).find({
      where: {
        ...(query.pacienteId ? { pacienteId: query.pacienteId } : {}),
        ...(query.camaId ? { camaId: query.camaId } : {}),
      },
      order: { fechaIngreso: 'DESC' },
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      pacienteId: row.pacienteId,
      camaId: row.camaId,
      medicoId: row.medicoId,
      motivoIngreso: row.motivoIngreso,
      fechaIngreso: row.fechaIngreso.toISOString(),
      fechaEgreso: row.fechaEgreso?.toISOString() ?? null,
      activa: row.fechaEgreso === null,
    }));
  }

  tieneInternacionActiva(pacienteId: string): Promise<boolean> {
    return this.dataSource
      .getRepository(Internacion)
      .exists({ where: { pacienteId, fechaEgreso: IsNull() } });
  }

  async ocupacion() {
    const [total, ocupadas] = await Promise.all([
      this.camas.count({ where: { activo: true } }),
      this.camas.count({ where: { activo: true, estado: EstadoCama.OCUPADA } }),
    ]);
    return {
      camasActivas: total,
      camasOcupadas: ocupadas,
      porcentajeOcupacion: total === 0 ? 0 : Number(((ocupadas / total) * 100).toFixed(2)),
    };
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
    actualizar?: (cama: Cama) => void,
  ): Promise<Cama> {
    return this.enTransaccion(async (manager) => {
      const cama = await this.bloquearCama(manager, camaId);
      cama.estado = this.transicionar(accion, cama);
      actualizar?.(cama);
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
    if (cama.activo === false) throw new NotFoundException('La cama no está activa.');
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
      habitacion: cama.habitacion
        ? {
            id: cama.habitacion.id,
            numero: cama.habitacion.numero,
            sectorId: cama.habitacion.sector.id,
            sector: cama.habitacion.sector.nombre,
            capacidad: cama.habitacion.capacidad,
          }
        : null,
      estado: cama.estado,
      paciente: p
        ? { id: p.id, nombre: p.nombre, apellido: p.apellido, documento: p.documento }
        : null,
      version: cama.version,
      activa: cama.activo ?? true,
      motivoBloqueo: cama.motivoBloqueo ?? null,
    };
  }

  private cargarCama(id: string): Promise<Cama> {
    return this.camas.findOneOrFail({
      where: { id },
      relations: { pacienteActual: true, habitacion: { sector: true } },
    });
  }
}