import { Injectable, type MessageEvent } from '@nestjs/common';
import { interval, map, merge, type Observable } from 'rxjs';
import { BedAssigned, type BedAssignedPayload } from '../../../shared/events/bed-assigned.event.js';
import { BedCleaned, type BedCleanedPayload } from '../../../shared/events/bed-cleaned.event.js';
import { BedReleased, type BedReleasedPayload } from '../../../shared/events/bed-released.event.js';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import {
  BED_BLOCKED,
  BED_UNBLOCKED,
  type BedBlockedPayload,
  type BedUnblockedPayload,
} from '../domain/bed-events.js';
import { EstadoCama } from '../domain/estado-cama.enum.js';

/** Cada cuánto se envía el latido para que proxies y navegadores no cierren la conexión. */
export const BED_STREAM_HEARTBEAT_MS = 25_000;

/** Cuerpo de cada mensaje del stream de camas. */
export interface BedStreamData {
  /** Tipo del evento de origen: bed.assigned, bed.released, bed.cleaned, bed.blocked o bed.unblocked. */
  tipo: string;
  camaId: string;
  numero: string;
  /** Estado en el que queda la cama después del evento. */
  estado: EstadoCama;
  /** Momento del cambio (ISO 8601). */
  at: string;
}

/**
 * Recursos 2.1: expone en tiempo real los cambios de estado de las camas para los monitores.
 * Solo traduce los eventos del EventBus (en memoria) a mensajes SSE; no consulta la base.
 * Un cliente que se conecta recibe los cambios desde ese momento: el estado inicial se pide a GET /camas.
 */
@Injectable()
export class BedEventsStreamService {
  constructor(private readonly events: EventBus) {}

  /** Cambios de cama más un latido periódico (evento `ping`). Al desuscribirse se libera todo. */
  stream(heartbeatMs: number = BED_STREAM_HEARTBEAT_MS): Observable<MessageEvent> {
    const latido = interval(heartbeatMs).pipe(
      map((): MessageEvent => ({ type: 'ping', data: { at: new Date().toISOString() } })),
    );
    return merge(this.cambios(), latido);
  }

  /** Solo los cambios de cama, ya traducidos. */
  cambios(): Observable<MessageEvent> {
    const mensaje = (data: BedStreamData): MessageEvent => ({ data });
    return merge(
      this.events.ofType<BedAssignedPayload>(BedAssigned.EVENT_TYPE).pipe(
        map(({ type, payload }) =>
          mensaje({ tipo: type, camaId: payload.bedId, numero: payload.bedNumber, estado: EstadoCama.OCUPADA, at: payload.assignedAt }),
        ),
      ),
      this.events.ofType<BedReleasedPayload>(BedReleased.EVENT_TYPE).pipe(
        map(({ type, payload }) =>
          mensaje({ tipo: type, camaId: payload.bedId, numero: payload.bedNumber, estado: EstadoCama.EN_LIMPIEZA, at: payload.releasedAt }),
        ),
      ),
      this.events.ofType<BedCleanedPayload>(BedCleaned.EVENT_TYPE).pipe(
        map(({ type, payload }) =>
          mensaje({ tipo: type, camaId: payload.bedId, numero: payload.bedNumber, estado: EstadoCama.LIBRE, at: payload.cleanedAt }),
        ),
      ),
      this.events.ofType<BedBlockedPayload>(BED_BLOCKED).pipe(
        map(({ type, payload }) =>
          mensaje({ tipo: type, camaId: payload.bedId, numero: payload.bedNumber, estado: EstadoCama.BLOQUEADA, at: payload.blockedAt }),
        ),
      ),
      this.events.ofType<BedUnblockedPayload>(BED_UNBLOCKED).pipe(
        map(({ type, payload }) =>
          mensaje({ tipo: type, camaId: payload.bedId, numero: payload.bedNumber, estado: EstadoCama.LIBRE, at: payload.unblockedAt }),
        ),
      ),
    );
  }
}
