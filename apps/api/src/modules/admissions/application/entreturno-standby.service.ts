import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  EntreturnoStandby,
  EstadoStandby,
} from '../../../entities/entreturno-standby.entity.js';
import { Paciente } from '../../../entities/paciente.entity.js';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { SessionIdentity } from '../../iam/application/auth.service.js';
import { AgregarEsperaDto } from '../api/dto/espera.dto.js';
import { clinicDateOf, clinicDayBounds } from './clinic-time.js';
import { TurnosService } from './turnos.service.js';

export interface EsperaSummary {
  id: string;
  fecha: string;
  /** Posición en la cola de ese médico y día (1 = el próximo en recibir un horario). */
  posicion: number;
  creadoEn: Date;
  medico: { id: string; nombre: string; apellido: string };
  paciente: { id: string; nombre: string; apellido: string };
}

/** HU 1.3: lista de espera de entreturnos. La promoción automática vive en TurnosService. */
@Injectable()
export class EntreturnoStandbyService {
  constructor(
    @InjectRepository(EntreturnoStandby)
    private readonly standby: Repository<EntreturnoStandby>,
    @InjectRepository(Paciente)
    private readonly pacientes: Repository<Paciente>,
    private readonly turnos: TurnosService,
    private readonly dataSource: DataSource,
  ) {}

  async join(
    dto: AgregarEsperaDto,
    identity: SessionIdentity,
  ): Promise<EsperaSummary> {
    if (dto.fecha < clinicDateOf(new Date())) {
      throw new BadRequestException(
        'No se puede anotar en la lista de espera de un día que ya pasó.',
      );
    }
    this.turnos.assertCanManageDoctor(identity, dto.medicoId);
    return this.dataSource.transaction(async (manager) => {
      // Mismo lock que usan la reserva y la cancelación: la cola y la agenda no se pisan.
      const doctor = await this.turnos.lockDoctor(manager, dto.medicoId);
      const patient = await this.pacientes.findOne({ where: { id: dto.pacienteId } });
      if (!patient) throw new NotFoundException('No se encontró el paciente.');

      const { desde, hasta } = clinicDayBounds(dto.fecha);
      const libres = await this.turnos.listAvailable(doctor.id, desde, hasta);
      if (libres.length > 0) {
        throw new ConflictException(
          'El médico todavía tiene horarios libres ese día. Reservá directamente uno de ellos.',
        );
      }

      const repository = manager.getRepository(EntreturnoStandby);
      try {
        const saved = await repository.save(
          repository.create({
            medico: doctor,
            paciente: patient,
            fecha: dto.fecha,
            estado: EstadoStandby.EN_COLA,
            turno: null,
          }),
        );
        const position = await repository.count({
          where: {
            medico: { id: doctor.id },
            fecha: dto.fecha,
            estado: EstadoStandby.EN_COLA,
          },
        });
        return this.toSummary(saved, doctor, patient, position);
      } catch (error) {
        const e = error as { code?: string; driverError?: { code?: string } };
        if (e?.code === '23505' || e?.driverError?.code === '23505') {
          throw new ConflictException(
            'El paciente ya está en la lista de espera de este médico para ese día.',
          );
        }
        throw error;
      }
    });
  }

  /** Cola del día (por defecto, hoy), ordenada por médico y por orden de llegada. */
  async list(
    filters: { medicoId?: string; fecha?: string },
    identity: SessionIdentity,
  ): Promise<EsperaSummary[]> {
    if (
      identity.rol === RolUsuario.MEDICO &&
      filters.medicoId &&
      filters.medicoId !== identity.accountId
    ) {
      throw new ForbiddenException('Solo podés consultar tu propia lista de espera.');
    }
    const medicoId =
      identity.rol === RolUsuario.MEDICO ? identity.accountId : filters.medicoId;
    const rows = await this.standby.find({
      where: {
        fecha: filters.fecha ?? clinicDateOf(new Date()),
        estado: EstadoStandby.EN_COLA,
        ...(medicoId ? { medico: { id: medicoId } } : {}),
      },
      relations: { medico: true, paciente: true },
      order: { createdAt: 'ASC' },
    });
    const positions = new Map<string, number>();
    return rows
      .sort((a, b) => a.medico.apellido.localeCompare(b.medico.apellido))
      .map((row) => {
        const position = (positions.get(row.medico.id) ?? 0) + 1;
        positions.set(row.medico.id, position);
        return this.toSummary(row, row.medico, row.paciente, position);
      });
  }

  async leave(id: string, identity: SessionIdentity): Promise<void> {
    const entry = await this.standby.findOne({
      where: { id },
      relations: { medico: true },
    });
    if (!entry || entry.estado !== EstadoStandby.EN_COLA) {
      throw new NotFoundException('No se encontró esa espera en la lista.');
    }
    this.turnos.assertCanManageDoctor(identity, entry.medico.id);
    entry.estado = EstadoStandby.RETIRADO;
    await this.standby.save(entry);
  }

  private toSummary(
    entry: EntreturnoStandby,
    medico: { id: string; nombre: string; apellido: string },
    paciente: { id: string; nombre: string; apellido: string },
    position: number,
  ): EsperaSummary {
    return {
      id: entry.id,
      fecha: entry.fecha,
      posicion: position,
      creadoEn: entry.createdAt,
      medico: { id: medico.id, nombre: medico.nombre, apellido: medico.apellido },
      paciente: {
        id: paciente.id,
        nombre: paciente.nombre,
        apellido: paciente.apellido,
      },
    };
  }
}
