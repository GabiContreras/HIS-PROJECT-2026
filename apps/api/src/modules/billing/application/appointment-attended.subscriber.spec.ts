import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { INTEGRATION_EVENTS } from '../../../shared/events/integration-event-names.js';
import { InMemoryOutboxStore } from '../../../shared/events/outbox/in-memory-outbox.store.js';
import { OutboxService } from '../../../shared/events/outbox/outbox.service.js';
import { APPOINTMENT_ATTENDED_EVENT, AppointmentAttendedSubscriber } from './appointment-attended.subscriber.js';

const attendedEvent = {
  type: INTEGRATION_EVENTS.ADMISSIONS_APPOINTMENT_ATTENDED,
  occurredAt: new Date().toISOString(),
  payload: { appointmentId: 't1', urgente: false },
};

describe('AppointmentAttendedSubscriber', () => {
  it('escucha el mismo texto de evento que publica Admisión', () => {
    expect(APPOINTMENT_ATTENDED_EVENT).toBe(INTEGRATION_EVENTS.ADMISSIONS_APPOINTMENT_ATTENDED);
    expect(APPOINTMENT_ATTENDED_EVENT).toBe('admissions.appointment-attended');
  });

  it('crea el cargo al recibir el evento que publica Admisión', async () => {
    const outbox = new OutboxService(new InMemoryOutboxStore());
    const bus = new EventBus(outbox);
    const billing = { createForAppointment: vi.fn().mockResolvedValue(undefined) };
    const subscriber = new AppointmentAttendedSubscriber(outbox, billing as never);
    subscriber.onModuleInit();

    bus.publish(attendedEvent);

    await vi.waitFor(() =>
      expect(billing.createForAppointment).toHaveBeenCalledWith({ appointmentId: 't1', urgente: false }),
    );
    subscriber.onModuleDestroy();
  });

  it('si la creación del cargo falla, el evento queda persistido y se reintenta sin perderse', async () => {
    const store = new InMemoryOutboxStore();
    const outbox = new OutboxService(store);
    const bus = new EventBus(outbox);
    const billing = {
      createForAppointment: vi.fn().mockRejectedValueOnce(new Error('db caída')).mockResolvedValue(undefined),
    };
    new AppointmentAttendedSubscriber(outbox, billing as never).onModuleInit();

    bus.publish(attendedEvent);
    await vi.waitFor(() => expect(store.records[0]?.attempts).toBe(1));
    await outbox.processDue(new Date(Date.now() + 3_600_000));

    expect(billing.createForAppointment).toHaveBeenCalledTimes(2);
    expect(store.records[0].pending).toBe(false);
  });
});
