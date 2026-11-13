import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { PatientWaiting, type PatientWaitingPayload } from '../../../shared/events/patient-waiting.event.js';
import { PatientWaitingSubscriber } from './patient-waiting.subscriber.js';

const payload = (over: Partial<PatientWaitingPayload> = {}): PatientWaitingPayload => ({
  appointmentId: 't1',
  doctorId: 'm1',
  patientId: 'p1',
  ...over,
});

function build() {
  const bus = new EventBus();
  const notificaciones = { notificarUsuarios: vi.fn().mockResolvedValue(undefined) };
  const pacientes = { get: vi.fn().mockResolvedValue({ nombre: 'Carlos', apellido: 'López' }) };
  const subscriber = new PatientWaitingSubscriber(bus, notificaciones as never, pacientes as never);
  subscriber.onModuleInit();
  return { bus, notificaciones, pacientes, subscriber };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('PatientWaitingSubscriber', () => {
  it('notifica al médico del turno con prioridad MEDIA y el nombre del paciente', async () => {
    const { bus, notificaciones } = build();
    bus.publish(new PatientWaiting(payload()));
    await flush();
    expect(notificaciones.notificarUsuarios).toHaveBeenCalledOnce();
    const [ids, contenido] = notificaciones.notificarUsuarios.mock.calls[0];
    expect(ids).toEqual(['m1']);
    expect(contenido).toMatchObject({ tipo: 'PACIENTE_EN_SALA_DE_ESPERA', prioridad: 'MEDIA' });
    expect(contenido.mensaje).toContain('Carlos López');
  });

  it('no propaga errores si falla la búsqueda del paciente', async () => {
    const { subscriber, pacientes, notificaciones } = build();
    pacientes.get.mockRejectedValue(new Error('db caída'));
    await expect(subscriber.handle(new PatientWaiting(payload()))).resolves.toBeUndefined();
    expect(notificaciones.notificarUsuarios).not.toHaveBeenCalled();
  });

  it('no propaga errores si falla el helper de notificaciones', async () => {
    const { subscriber, notificaciones } = build();
    notificaciones.notificarUsuarios.mockRejectedValue(new Error('fallo'));
    await expect(subscriber.handle(new PatientWaiting(payload()))).resolves.toBeUndefined();
  });
});
