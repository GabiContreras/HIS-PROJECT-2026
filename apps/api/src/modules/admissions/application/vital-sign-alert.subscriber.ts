import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Subscription } from 'rxjs';
import { IsNull, Repository } from 'typeorm';
import { Internacion } from '../../../entities/internacion.entity.js';
import { EstadoCuenta, RolUsuario, Usuario } from '../../../entities/usuario.entity.js';
import type { DomainEvent } from '../../../shared/events/domain-event.js';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { VitalSignAlert, type VitalSignAlertPayload } from '../../../shared/events/vital-sign-alert.event.js';
import { NotificacionesService } from './notificaciones.service.js';
import { PacientesService } from './pacientes.service.js';

const TIPO_TEMPERATURA = 'TEMPERATURA';
const TEMPERATURA_ALERTA_C = 39;

@Injectable()
export class VitalSignAlertSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VitalSignAlertSubscriber.name);
  private subscription?: Subscription;

  constructor(
    private readonly eventBus: EventBus,
    private readonly notificacionesService: NotificacionesService,
    private readonly pacientes: PacientesService,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Internacion) private readonly internaciones: Repository<Internacion>,
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
      const contenido = {
        tipo: 'SIGNOS_VITALES_ALERTA',
        prioridad: 'ALTA',
        mensaje: `¡ALTA PRIORIDAD! Temperatura de ${valor} ${unidad} (supera ${TEMPERATURA_ALERTA_C} °C) en el paciente ${paciente.nombre} ${paciente.apellido}.`,
      } as const;
      const medicoId = await this.medicoResponsableActivo(patientId);
      if (medicoId) {
        await this.notificacionesService.notificarUsuarios([medicoId], contenido);
      } else {
        await this.notificacionesService.notificarPorRol(RolUsuario.MEDICO, contenido);
      }
    } catch (error) {
      this.logger.error(
        `No se pudo notificar la alerta de temperatura del paciente ${patientId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async medicoResponsableActivo(patientId: string): Promise<string | null> {
    const internacion = await this.internaciones.findOne({
      where: { pacienteId: patientId, fechaEgreso: IsNull() },
    });
    if (!internacion) return null;
    const medico = await this.usuarios.findOne({
      where: { id: internacion.medicoId, rol: RolUsuario.MEDICO, estado: EstadoCuenta.ACTIVO },
      select: { id: true },
    });
    return medico?.id ?? null;
  }
}
