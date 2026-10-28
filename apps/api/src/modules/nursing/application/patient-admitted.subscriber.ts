import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subscription } from 'rxjs';
import type { DomainEvent } from '../../../shared/events/domain-event.js';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { PatientAdmitted, type PatientAdmittedPayload } from '../../../shared/events/patient-admitted.event.js';
import { ProtocolosService } from './protocolos.service.js';

/**
 * Al recibir el ingreso de un paciente, genera su protocolo de atención base (HU 2.1).
 * Nunca lanza hacia el EventBus: cualquier fallo (motivo sin protocolo, paciente inexistente,
 * error de base) se registra con log. Reprocesar el mismo ingreso no duplica el protocolo.
 */
@Injectable()
export class PatientAdmittedSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PatientAdmittedSubscriber.name);
  private subscription?: Subscription;

  constructor(
    private readonly events: EventBus,
    private readonly protocolos: ProtocolosService,
  ) {}

  onModuleInit(): void {
    this.subscription = this.events.ofType<PatientAdmittedPayload>(PatientAdmitted.EVENT_TYPE).subscribe((event) => {
      void this.handle(event);
    });
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  /** Nunca rechaza: los errores se registran y se descartan. */
  async handle(event: DomainEvent<PatientAdmittedPayload>): Promise<void> {
    const { admissionId, patientId, reason } = event.payload;
    try {
      const { creado } = await this.protocolos.generarParaIngreso({
        ingresoId: admissionId,
        pacienteId: patientId,
        motivoIngreso: reason,
      });
      this.logger.log(
        creado
          ? `Protocolo de ingreso generado para el ingreso ${admissionId}.`
          : `El ingreso ${admissionId} ya tenía protocolo; no se duplica.`,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo generar el protocolo del ingreso ${admissionId} (paciente ${patientId}): ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
