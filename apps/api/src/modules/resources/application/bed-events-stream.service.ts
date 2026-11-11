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

export const BED_STREAM_HEARTBEAT_MS = 25_000;

export interface BedStreamData {
  tipo: string;
  camaId: string;
  numero: string;
  estado: EstadoCama;
  at: string;
}

@Injectable()
export class BedEventsStreamService {
  constructor(private readonly events: EventBus) {}

  stream(heartbeatMs: number = BED_STREAM_HEARTBEAT_MS): Observable<MessageEvent> {
    const latido = interval(heartbeatMs).pipe(
      map((): MessageEvent => ({ type: 'ping', data: { at: new Date().toISOString() } })),
    );
    return merge(this.cambios(), latido);
  }

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
