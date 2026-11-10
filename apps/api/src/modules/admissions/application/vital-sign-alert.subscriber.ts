import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Subscription } from 'rxjs';
import { Repository } from 'typeorm';
import { EstadoCuenta, RolUsuario, Usuario } from '../../../entities/usuario.entity.js';
import type { DomainEvent } from '../../../shared/events/domain-event.js';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { VitalSignAlert, type VitalSignAlertPayload } from '../../../shared/events/vital-sign-alert.event.js';
import { NotificacionesService } from './notificaciones.service.js';
import { PacientesService } from './pacientes.service.js';

/** HU 1.1 (Enfermería), escenario 2: la temperatura supera los 39 °C. */
const TIPO_TEMPERATURA = 'TEMPERATURA';
const TEMPERATURA_ALERTA_C = 39;

/**
 * Convierte la alerta de signos vitales de Enfermería en una notificación de alta prioridad para los médicos
 * (HU 1.1: "emitir una notificación de alta prioridad al médico de guardia"). Nunca lanza hacia el EventBus.
 */
@Injectable()
export class VitalSignAlertSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VitalSignAlertSubscriber.name);
  private subscription?: Subscription;

  constructor(
    private readonly eventBus: EventBus,
    private readonly notificacionesService: NotificacionesService,
    private readonly pacientes: PacientesService,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
  ) {}

  onModuleInit(): void {
    this.subscription = this.eventBus
      .ofType<VitalSignAlertPayload>(VitalSignAlert.EVENT_TYPE)
      .subscribe((event) => void this.handle(event));
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  async handle(event: DomainEvent<VitalSignAlertPayload>): Promise<void> {
    const { tipo, valor, unidad, patientId } = event.payload;
    if (tipo !== TIPO_TEMPERATURA || !(valor > TEMPERATURA_ALERTA_C)) return;
    try {
      const paciente = await this.pacientes.get(patientId);
      // Hoy no existe el vínculo médico–sector de internación: se avisa a todos los médicos activos.
      const medicos = await this.usuarios.find({
        where: { rol: RolUsuario.MEDICO, estado: EstadoCuenta.ACTIVO },
        select: { id: true },
      });
      await Promise.all(
        medicos.map((medico) =>
          this.notificacionesService.crearNotificacion({
            destinatarioId: medico.id,
            tipo: 'SIGNOS_VITALES_ALERTA',
            prioridad: 'ALTA',
            mensaje: `¡ALTA PRIORIDAD! Temperatura de ${valor} ${unidad} (supera ${TEMPERATURA_ALERTA_C} °C) en el paciente ${paciente.nombre} ${paciente.apellido}.`,
          }),
        ),
      );
    } catch (error) {
      this.logger.error(
        `No se pudo notificar la alerta de temperatura del paciente ${patientId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
