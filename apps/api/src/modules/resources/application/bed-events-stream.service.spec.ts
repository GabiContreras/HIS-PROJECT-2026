import type { MessageEvent } from '@nestjs/common';
import { BedAssigned } from '../../../shared/events/bed-assigned.event.js';
import { BedCleaned } from '../../../shared/events/bed-cleaned.event.js';
import { BedReleased } from '../../../shared/events/bed-released.event.js';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { PatientAdmitted } from '../../../shared/events/patient-admitted.event.js';
import { BED_BLOCKED, BED_UNBLOCKED } from '../domain/bed-events.js';
import { EstadoCama } from '../domain/estado-cama.enum.js';
import type { DataSource } from 'typeorm';
import { BED_STREAM_HEARTBEAT_MS, BedEventsStreamService } from './bed-events-stream.service.js';

const AT = '2030-01-01T10:00:00.000Z';
const CAMA = { bedId: 'cama-1', bedNumber: '101' };

function build() {
  const events = new EventBus();
  const service = new BedEventsStreamService(events);
  return { events, service };
}

describe('BedEventsStreamService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('emite un mensaje por cada evento de cama con el estado en el que queda', () => {
    const { events, service } = build();
    const recibidos: MessageEvent[] = [];
    const sub = service.stream().subscribe((m) => recibidos.push(m));

    events.publish(new BedAssigned({ ...CAMA, patientId: 'p1', assignedAt: AT }));
    events.publish(new BedReleased({ ...CAMA, patientId: 'p1', admissionId: 'i1', releasedAt: AT }));
    events.publish(new BedCleaned({ ...CAMA, cleanedAt: AT }));
    events.publish({ type: BED_BLOCKED, occurredAt: AT, payload: { ...CAMA, blockedAt: AT } });
    events.publish({ type: BED_UNBLOCKED, occurredAt: AT, payload: { ...CAMA, unblockedAt: AT } });
    sub.unsubscribe();

    expect(recibidos.map((m) => m.data)).toEqual([
      { tipo: 'bed.assigned', camaId: 'cama-1', numero: '101', estado: EstadoCama.OCUPADA, at: AT },
      { tipo: 'bed.released', camaId: 'cama-1', numero: '101', estado: EstadoCama.EN_LIMPIEZA, at: AT },
      { tipo: 'bed.cleaned', camaId: 'cama-1', numero: '101', estado: EstadoCama.LIBRE, at: AT },
      { tipo: 'bed.blocked', camaId: 'cama-1', numero: '101', estado: EstadoCama.BLOQUEADA, at: AT },
      { tipo: 'bed.unblocked', camaId: 'cama-1', numero: '101', estado: EstadoCama.LIBRE, at: AT },
    ]);
    // Los cambios de cama van como mensaje por defecto (sin `type`), para que el cliente los reciba en onmessage.
    expect(recibidos.every((m) => m.type === undefined)).toBe(true);
  });

  it('ignora los eventos que no son de cama', () => {
    const { events, service } = build();
    const recibidos: MessageEvent[] = [];
    const sub = service.stream().subscribe((m) => recibidos.push(m));

    events.publish(new PatientAdmitted({ admissionId: 'i1', patientId: 'p1', reason: 'Neumonía', admittedAt: AT }));
    sub.unsubscribe();

    expect(recibidos).toHaveLength(0);
  });

  it('deja de emitir cuando el cliente cancela la suscripción', () => {
    const { events, service } = build();
    const recibidos: MessageEvent[] = [];
    const sub = service.stream().subscribe((m) => recibidos.push(m));

    events.publish(new BedCleaned({ ...CAMA, cleanedAt: AT }));
    sub.unsubscribe();
    events.publish(new BedCleaned({ ...CAMA, cleanedAt: AT }));

    expect(recibidos).toHaveLength(1);
  });

  it('entrega cada evento a todos los clientes conectados', () => {
    const { events, service } = build();
    const a: MessageEvent[] = [];
    const b: MessageEvent[] = [];
    const subA = service.stream().subscribe((m) => a.push(m));
    const subB = service.stream().subscribe((m) => b.push(m));

    events.publish(new BedCleaned({ ...CAMA, cleanedAt: AT }));
    subA.unsubscribe();
    subB.unsubscribe();

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it('envía un latido "ping" periódico y lo corta al desuscribirse', () => {
    vi.useFakeTimers();
    const { service } = build();
    const recibidos: MessageEvent[] = [];
    const sub = service.stream().subscribe((m) => recibidos.push(m));

    vi.advanceTimersByTime(BED_STREAM_HEARTBEAT_MS * 2);
    expect(recibidos.map((m) => m.type)).toEqual(['ping', 'ping']);
    expect(recibidos[0].data).toEqual({ at: expect.any(String) });

    sub.unsubscribe();
    vi.advanceTimersByTime(BED_STREAM_HEARTBEAT_MS * 3);
    expect(recibidos).toHaveLength(2);
  });

  it('no repite un evento persistido cuando created_at tiene microsegundos', async () => {
    vi.useFakeTimers();
    const microsegundos = (valor: unknown): bigint => {
      if (valor instanceof Date) return BigInt(valor.getTime()) * 1000n;
      const [, base, fraccion] = /^(.*?)(?:\.(\d+))?\+00$/.exec(String(valor)) ?? [];
      return BigInt(Date.parse(base.replace(' ', 'T') + 'Z')) * 1000n + BigInt((fraccion ?? '').padEnd(6, '0'));
    };
    const fila = {
      id: '11111111-1111-4111-8111-111111111111',
      event_type: 'bed.assigned',
      payload: { ...CAMA, assignedAt: AT },
      created_at: new Date('2030-01-01T10:00:00.123Z'),
      created_at_cursor: '2030-01-01 10:00:00.123456+00',
    };
    const consultas: unknown[][] = [];
    const dataSource = {
      query: vi.fn(async (_sql: string, params: unknown[]) => {
        consultas.push(params);
        return microsegundos(params[1]) < microsegundos(fila.created_at_cursor) ? [fila] : [];
      }),
    } as unknown as DataSource;
    const service = new BedEventsStreamService(new EventBus(), dataSource);
    const recibidos: MessageEvent[] = [];
    const sub = service.stream().subscribe((m) => recibidos.push(m));

    vi.setSystemTime(new Date('2030-01-01T09:00:00.000Z'));
    await vi.advanceTimersByTimeAsync(5_000);
    sub.unsubscribe();

    expect(consultas.length).toBeGreaterThanOrEqual(4);
    expect(recibidos.map((m) => m.data)).toEqual([
      { tipo: 'bed.assigned', camaId: 'cama-1', numero: '101', estado: EstadoCama.OCUPADA, at: AT },
    ]);
    expect(consultas[1][1]).toBe(fila.created_at_cursor);
  });
});
