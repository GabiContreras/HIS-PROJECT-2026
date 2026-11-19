import { Inject, Injectable, Optional, type MessageEvent } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { concatMap, defer, from, interval, map, merge, type Observable } from 'rxjs';
import { BedAssigned, type BedAssignedPayload } from '../../../shared/events/bed-assigned.event.js';
import { BedCleaned, type BedCleanedPayload } from '../../../shared/events/bed-cleaned.event.js';
import { BedReleased, type BedReleasedPayload } from '../../../shared/events/bed-released.event.js';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { BedTransferred, type BedTransferredPayload } from '../../../shared/events/bed-transferred.event.js';
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

interface PersistedBedEvent {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: Date | string;
  created_at_cursor: string;
}

/**
 * Recursos 2.1: expone en tiempo real los cambios de estado de las camas para los monitores.
 * Solo traduce los eventos del EventBus (en memoria) a mensajes SSE; no consulta la base.
 * Un cliente que se conecta recibe los cambios desde ese momento: el estado inicial se pide a GET /camas.
 */
@Injectable()
export class BedEventsStreamService {
  constructor(
    private readonly events: EventBus,
    @Optional() @Inject(DataSource) private readonly dataSource: DataSource | null = null,
  ) {}

  /** Cambios de cama más un latido periódico (evento `ping`). Al desuscribirse se libera todo. */
  stream(heartbeatMs: number = BED_STREAM_HEARTBEAT_MS): Observable<MessageEvent> {
    const latido = interval(heartbeatMs).pipe(
      map((): MessageEvent => ({ type: 'ping', data: { at: new Date().toISOString() } })),
    );
    return merge(this.dataSource ? this.cambiosPersistidos() : this.cambios(), latido);
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
      this.events.ofType<BedTransferredPayload>(BedTransferred.EVENT_TYPE).pipe(
        concatMap(({ type, payload }) =>
          from([
            mensaje({
              tipo: type,
              camaId: payload.camaOrigenId,
              numero: payload.camaOrigenNumero,
              estado: EstadoCama.EN_LIMPIEZA,
              at: payload.trasladadoEn,
            }),
            mensaje({
              tipo: type,
              camaId: payload.camaDestinoId,
              numero: payload.camaDestinoNumero,
              estado: EstadoCama.OCUPADA,
              at: payload.trasladadoEn,
            }),
          ]),
        ),
      ),
    );
  }

  private cambiosPersistidos(): Observable<MessageEvent> {
    const dataSource = this.dataSource;
    if (!dataSource) throw new Error('El stream persistente de camas requiere una conexión de base de datos.');

    return defer(() => {
      let cursorAt: Date | string = new Date();
      let cursorId = '00000000-0000-0000-0000-000000000000';
      return interval(1_000).pipe(
        concatMap(() =>
          from(
            dataSource.query<PersistedBedEvent[]>(
              `SELECT id, event_type, payload, created_at, created_at::text AS created_at_cursor
               FROM outbox_events
               WHERE event_type = ANY($1::varchar[])
                 AND (created_at, id) > ($2::timestamptz, $3::uuid)
               ORDER BY created_at, id
               LIMIT 100`,
              [
                [
                  BedAssigned.EVENT_TYPE,
                  BedReleased.EVENT_TYPE,
                  BedCleaned.EVENT_TYPE,
                  BED_BLOCKED,
                  BED_UNBLOCKED,
                  BedTransferred.EVENT_TYPE,
                ],
                cursorAt,
                cursorId,
              ],
            ),
          ),
        ),
        concatMap((rows) => from(rows)),
        concatMap((row) => {
          cursorAt = row.created_at_cursor;
          cursorId = row.id;
          return from(this.toMessages(row));
        }),
      );
    });
  }

  private toMessages(row: PersistedBedEvent): MessageEvent[] {
    const payload = row.payload;
    const bedId = String(payload.bedId ?? payload.camaDestinoId ?? '');
    const bedNumber = String(payload.bedNumber ?? bedId);
    const at = String(
      payload.assignedAt ??
        payload.releasedAt ??
        payload.cleanedAt ??
        payload.blockedAt ??
        payload.unblockedAt ??
        payload.trasladadoEn ??
        row.created_at,
    );
    if (row.event_type === BedTransferred.EVENT_TYPE) {
      const event = (camaId: string, numero: string, estado: EstadoCama): MessageEvent => ({
        data: { tipo: row.event_type, camaId, numero, estado, at },
      });
      return [
        event(String(payload.camaOrigenId), String(payload.camaOrigenNumero), EstadoCama.EN_LIMPIEZA),
        event(String(payload.camaDestinoId), String(payload.camaDestinoNumero), EstadoCama.OCUPADA),
      ];
    }

    const estado =
      row.event_type === BedAssigned.EVENT_TYPE
        ? EstadoCama.OCUPADA
        : row.event_type === BedReleased.EVENT_TYPE
          ? EstadoCama.EN_LIMPIEZA
          : row.event_type === BED_BLOCKED
            ? EstadoCama.BLOQUEADA
            : EstadoCama.LIBRE;
    return [{ data: { tipo: row.event_type, camaId: bedId, numero: bedNumber, estado, at } }];
  }
}
