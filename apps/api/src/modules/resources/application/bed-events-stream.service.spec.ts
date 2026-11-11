import type { MessageEvent } from '@nestjs/common';
import { BedAssigned } from '../../../shared/events/bed-assigned.event.js';
import { BedCleaned } from '../../../shared/events/bed-cleaned.event.js';
import { BedReleased } from '../../../shared/events/bed-released.event.js';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { PatientAdmitted } from '../../../shared/events/patient-admitted.event.js';
import { BED_BLOCKED, BED_UNBLOCKED } from '../domain/bed-events.js';
import { EstadoCama } from '../domain/estado-cama.enum.js';
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
});
