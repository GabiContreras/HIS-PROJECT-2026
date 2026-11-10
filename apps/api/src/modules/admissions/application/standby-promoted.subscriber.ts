import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Subscription } from 'rxjs';
import { Repository } from 'typeorm';
import { RolUsuario, Usuario } from '../../../entities/usuario.entity.js';
import type { DomainEvent } from '../../../shared/events/domain-event.js';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { StandbyPromoted, type StandbyPromotedPayload } from '../../../shared/events/standby-promoted.event.js';
import { CLINIC_TIME_ZONE } from './clinic-time.js';
import { NotificacionesService } from './notificaciones.service.js';
import { PacientesService } from './pacientes.service.js';

const horarioFormat = new Intl.DateTimeFormat('es-AR', {
  timeZone: CLINIC_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

@Injectable()
export class StandbyPromotedSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StandbyPromotedSubscriber.name);
  private subscription?: Subscription;

  constructor(
    private readonly eventBus: EventBus,
    private readonly notificacionesService: NotificacionesService,
    private readonly pacientes: PacientesService,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
  ) {}

  onModuleInit(): void {
    this.subscription = this.eventBus
      .ofType<StandbyPromotedPayload>(StandbyPromoted.EVENT_TYPE)
      .subscribe((event) => void this.handle(event));
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  async handle(event: DomainEvent<StandbyPromotedPayload>): Promise<void> {
    const { doctorId, patientId, scheduledAt, appointmentId } = event.payload;
    try {
      const paciente = await this.pacientes.get(patientId);
      const medico = await this.usuarios.findOneOrFail({ where: { id: doctorId } });
      await this.notificacionesService.notificarPorRol(RolUsuario.ADMINISTRATIVO, {
        tipo: 'ESPERA_PROMOVIDA',
        prioridad: 'MEDIA',
        mensaje: `Se asignó a ${paciente.nombre} ${paciente.apellido}, de la lista de espera, el turno con ${medico.nombre} ${medico.apellido} del ${horarioFormat.format(new Date(scheduledAt))}.`,
      });
    } catch (error) {
      this.logger.error(
        `No se pudo avisar la promoción de la lista de espera del turno ${appointmentId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
