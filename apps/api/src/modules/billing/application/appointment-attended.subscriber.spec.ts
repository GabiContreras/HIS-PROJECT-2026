import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { INTEGRATION_EVENTS } from '../../../shared/events/integration-event-names.js';
import { APPOINTMENT_ATTENDED_EVENT, AppointmentAttendedSubscriber } from './appointment-attended.subscriber.js';

describe('AppointmentAttendedSubscriber', () => {
  it('escucha el mismo texto de evento que publica Admisión', () => {
    expect(APPOINTMENT_ATTENDED_EVENT).toBe(INTEGRATION_EVENTS.ADMISSIONS_APPOINTMENT_ATTENDED);
    expect(APPOINTMENT_ATTENDED_EVENT).toBe('admissions.appointment-attended');
  });

  it('crea el cargo al recibir el evento que publica Admisión', async () => {
    const bus = new EventBus();
    const billing = { createForAppointment: vi.fn().mockResolvedValue(undefined) };
    const subscriber = new AppointmentAttendedSubscriber(bus, billing as never);
    subscriber.onModuleInit();
    bus.publish({
      type: INTEGRATION_EVENTS.ADMISSIONS_APPOINTMENT_ATTENDED,
      occurredAt: new Date().toISOString(),
      payload: { appointmentId: 't1', urgente: false },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(billing.createForAppointment).toHaveBeenCalledWith({ appointmentId: 't1', urgente: false });
    subscriber.onModuleDestroy();
  });
});
