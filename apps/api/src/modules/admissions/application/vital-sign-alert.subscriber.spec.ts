import { describe, expect, it, vi } from 'vitest';
import { VitalSignAlert, type VitalSignAlertPayload } from '../../../shared/events/vital-sign-alert.event.js';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { VitalSignAlertSubscriber } from './vital-sign-alert.subscriber.js';

const payload = (over: Partial<VitalSignAlertPayload> = {}): VitalSignAlertPayload => ({
  vitalSignId: 's1',
  patientId: 'p1',
  tipo: 'TEMPERATURA',
  valor: 39.5,
  unidad: '°C',
  registeredBy: 'e1',
  registeredAt: new Date().toISOString(),
  ...over,
});

function build(medicos = [{ id: 'm1' }, { id: 'm2' }]) {
  const bus = new EventBus();
  const notificaciones = { crearNotificacion: vi.fn().mockResolvedValue({}) };
  const pacientes = { get: vi.fn().mockResolvedValue({ nombre: 'Carlos', apellido: 'López' }) };
  const usuarios = { find: vi.fn().mockResolvedValue(medicos) };
  const subscriber = new VitalSignAlertSubscriber(bus, notificaciones as never, pacientes as never, usuarios as never);
  subscriber.onModuleInit();
  return { bus, notificaciones, usuarios, subscriber };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('VitalSignAlertSubscriber', () => {
  it('notifica con prioridad ALTA a cada médico activo cuando la temperatura supera 39 °C', async () => {
    const { bus, notificaciones } = build();
    bus.publish(new VitalSignAlert(payload()));
    await flush();
    expect(notificaciones.crearNotificacion).toHaveBeenCalledTimes(2);
    expect(notificaciones.crearNotificacion).toHaveBeenCalledWith(
      expect.objectContaining({ destinatarioId: 'm1', prioridad: 'ALTA', tipo: 'SIGNOS_VITALES_ALERTA' }),
    );
    expect(notificaciones.crearNotificacion.mock.calls[0][0].mensaje).toContain('Carlos López');
  });

  it('ignora alertas que no son de temperatura crítica', async () => {
    const { bus, notificaciones } = build();
    bus.publish(new VitalSignAlert(payload({ tipo: 'FRECUENCIA_CARDIACA', valor: 180, unidad: 'lpm' })));
    bus.publish(new VitalSignAlert(payload({ valor: 39 })));
    await flush();
    expect(notificaciones.crearNotificacion).not.toHaveBeenCalled();
  });

  it('no propaga errores al bus si falla la base', async () => {
    const { subscriber, usuarios } = build();
    usuarios.find.mockRejectedValue(new Error('db caída'));
    await expect(subscriber.handle(new VitalSignAlert(payload()))).resolves.toBeUndefined();
  });
});
