import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subscription } from 'rxjs';
import type { DomainEvent } from '../../../shared/events/domain-event.js';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { PatientWaiting, type PatientWaitingPayload } from '../../../shared/events/patient-waiting.event.js';
import { NotificacionesService } from './notificaciones.service.js';
import { PacientesService } from './pacientes.service.js';

@Injectable()
export class PatientWaitingSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PatientWaitingSubscriber.name);
  private subscription?: Subscription;

  constructor(
    private readonly eventBus: EventBus,
    private readonly notificacionesService: NotificacionesService,
    private readonly pacientes: PacientesService,
  ) {}

  onModuleInit(): void {
    this.subscription = this.eventBus
      .ofType<PatientWaitingPayload>(PatientWaiting.EVENT_TYPE)
      .subscribe((event) => void this.handle(event));
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  async handle(event: DomainEvent<PatientWaitingPayload>): Promise<void> {
    const { doctorId, patientId, appointmentId } = event.payload;
    try {
      const paciente = await this.pacientes.get(patientId);
      await this.notificacionesService.notificarUsuarios([doctorId], {
        tipo: 'PACIENTE_EN_SALA_DE_ESPERA',
        prioridad: 'MEDIA',
        mensaje: `El paciente ${paciente.nombre} ${paciente.apellido} está en la sala de espera.`,
      });
    } catch (error) {
      this.logger.error(
        `No se pudo avisar la espera del turno ${appointmentId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
