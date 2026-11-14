import { describe, expect, it, vi } from 'vitest';
import { EventBus } from './event-bus.service.js';
import { INTEGRATION_EVENTS } from './integration-event-names.js';
import type { OutboxService } from './outbox/outbox.service.js';

const eventOfType = (type: string) => ({
  type,
  occurredAt: '2030-01-01T10:00:00.000Z',
  payload: { id: 'x' },
});

const fakeOutbox = () => ({
  isDurable: vi.fn((type: string) => type === INTEGRATION_EVENTS.MEDICATION_ADMINISTERED),
  enqueue: vi.fn().mockResolvedValue(undefined),
});

describe('EventBus', () => {
  it('entrega a los suscriptores en memoria sin outbox', () => {
    const bus = new EventBus();
    const received: unknown[] = [];
    bus.ofType(INTEGRATION_EVENTS.BED_ASSIGNED).subscribe((event) => received.push(event));

    bus.publish(eventOfType(INTEGRATION_EVENTS.BED_ASSIGNED));
    bus.publish(eventOfType(INTEGRATION_EVENTS.BED_RELEASED));

    expect(received).toHaveLength(1);
  });

  it('encola en el outbox los eventos durables y mantiene la entrega en memoria', () => {
    const outbox = fakeOutbox();
    const bus = new EventBus(outbox as unknown as OutboxService);
    const received: unknown[] = [];
    bus.ofType(INTEGRATION_EVENTS.MEDICATION_ADMINISTERED).subscribe((event) => received.push(event));
    const event = eventOfType(INTEGRATION_EVENTS.MEDICATION_ADMINISTERED);

    bus.publish(event);

    expect(outbox.enqueue).toHaveBeenCalledWith(event);
    expect(received).toEqual([event]);
  });

  it('no encola los eventos que no son durables', () => {
    const outbox = fakeOutbox();
    const bus = new EventBus(outbox as unknown as OutboxService);

    bus.publish(eventOfType(INTEGRATION_EVENTS.BED_ASSIGNED));

    expect(outbox.enqueue).not.toHaveBeenCalled();
  });
});
