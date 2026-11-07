import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { NotificacionesService } from './notificaciones.service.js';

@Injectable()
export class VitalSignAlertSubscriber implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBus,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  onModuleInit() {
    const bus = this.eventBus as any;
    const listener = (event: any) => {
      if (event && event.temperatura && event.temperatura > 39) {
        this.notificacionesService.crearNotificacion({
          destinatarioId: event.medicoId || event.medicoDestinoId || 'medico-guardia-general',
          tipo: 'SIGNOS_VITALES_ALERTA',
          prioridad: 'ALTA',
          mensaje: `¡ALTA PRIORIDAD! El paciente ${event.pacienteNombre || 'en internación'} superó los 39°C de temperatura (${event.temperatura}°C).`,
        });
      }
    };

    if (typeof bus.subscribe === 'function') {
      bus.subscribe('VitalSignAlert', listener);
    } else if (typeof bus.on === 'function') {
      bus.on('VitalSignAlert', listener);
    }
  }
}