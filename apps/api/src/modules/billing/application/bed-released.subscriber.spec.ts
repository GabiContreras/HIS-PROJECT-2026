import { describe, expect, it, vi } from 'vitest';
import { BedReleased, BedReleasedPayload } from '../../../shared/events/bed-released.event.js';
import { BedTransferred } from '../../../shared/events/bed-transferred.event.js';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { INTEGRATION_EVENTS } from '../../../shared/events/integration-event-names.js';
import { InMemoryOutboxStore } from '../../../shared/events/outbox/in-memory-outbox.store.js';
import { OutboxService } from '../../../shared/events/outbox/outbox.service.js';
import { Cargo } from '../../../entities/cargo.entity.js';
import {
  BedReleasedSubscriber,
  BILLING_BED_RELEASED_CONSUMER,
} from './bed-released.subscriber.js';
import { MedicationAdministeredSubscriber } from './medication-administered.subscriber.js';

const payload: BedReleasedPayload = {
  bedId: 'cama-1',
  camaId: 'cama-1',
  bedNumber: '101',
  patientId: 'paciente-1',
  admissionId: 'int-1',
  releasedAt: '2026-11-12T12:00:00.000Z',
  internacionId: 'int-1',
  fechaIngreso: '2026-11-09T13:00:00.000Z',
  fechaEgreso: '2026-11-12T12:00:00.000Z',
};

describe('BedReleasedSubscriber', () => {
  it('se registra con el nombre y el tipo de evento correctos', () => {
    const outbox = { registerConsumer: vi.fn(), unregisterConsumer: vi.fn() };
    const subscriber = new BedReleasedSubscriber(outbox as never, {} as never);

    subscriber.onModuleInit();
    subscriber.onModuleDestroy();

    expect(BILLING_BED_RELEASED_CONSUMER).toBe('billing.bed-released');
    expect(outbox.registerConsumer).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'billing.bed-released',
        eventType: INTEGRATION_EVENTS.BED_RELEASED,
      }),
    );
    expect(outbox.unregisterConsumer).toHaveBeenCalledWith('billing.bed-released');
  });

  it('traduce el payload de bed.released a la creación del cargo', async () => {
    const outbox = new OutboxService(new InMemoryOutboxStore());
    const bus = new EventBus(outbox);
    const billing = { createForBedStay: vi.fn().mockResolvedValue(undefined) };
    const subscriber = new BedReleasedSubscriber(outbox, billing as never);
    subscriber.onModuleInit();

    bus.publish(new BedReleased(payload, 'int-1'));

    await vi.waitFor(() => expect(billing.createForBedStay).toHaveBeenCalledWith(payload));
    subscriber.onModuleDestroy();
  });

  it('un traslado seguido de un alta produce exactamente un cargo', async () => {
    const outbox = new OutboxService(new InMemoryOutboxStore());
    const bus = new EventBus(outbox);
    const billing = { createForBedStay: vi.fn().mockResolvedValue({} as Cargo) };
    new BedReleasedSubscriber(outbox, billing as never).onModuleInit();
    new MedicationAdministeredSubscriber(outbox, {} as never).onModuleInit();

    bus.publish(
      new BedTransferred(
        {
          internacionId: 'int-1',
          patientId: 'paciente-1',
          camaOrigenId: 'cama-1',
          camaDestinoId: 'cama-2',
          camaOrigenNumero: '101',
          camaDestinoNumero: '102',
          fechaIngreso: '2026-11-09T13:00:00.000Z',
          fechaEgreso: null,
          trasladadoEn: '2026-11-10T13:00:00.000Z',
        },
        'int-1',
      ),
    );
    bus.publish(new BedReleased(payload, 'int-1'));

    await vi.waitFor(() => expect(billing.createForBedStay).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(billing.createForBedStay).toHaveBeenCalledTimes(1);
  });

  it('billing no registra ningún consumidor para bed.transferred', () => {
    const registered: Array<{ name: string; eventType: string }> = [];
    const outbox = {
      registerConsumer: (consumer: { name: string; eventType: string }) => registered.push(consumer),
    };

    new BedReleasedSubscriber(outbox as never, {} as never).onModuleInit();

    expect(registered.map((consumer) => consumer.eventType)).not.toContain(
      INTEGRATION_EVENTS.BED_TRANSFERRED,
    );
  });

  it('si el cargo falla, el evento se reintenta sin perderse', async () => {
    const store = new InMemoryOutboxStore();
    const outbox = new OutboxService(store);
    const bus = new EventBus(outbox);
    const billing = {
      createForBedStay: vi
        .fn()
        .mockRejectedValueOnce(new Error('db caída'))
        .mockResolvedValue(undefined),
    };
    new BedReleasedSubscriber(outbox, billing as never).onModuleInit();

    bus.publish(new BedReleased(payload, 'int-1'));
    await vi.waitFor(() => expect(store.records[0]?.attempts).toBe(1));
    await outbox.processDue(new Date(Date.now() + 3_600_000));

    expect(billing.createForBedStay).toHaveBeenCalledTimes(2);
    expect(store.records[0].pending).toBe(false);
  });
});
