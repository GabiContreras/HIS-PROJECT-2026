import { describe, expect, it, vi } from 'vitest';
import { RolUsuario } from '../../../entities/usuario.entity.js';
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

function build(opts: { internacion?: { medicoId: string } | null; medicoActivo?: boolean } = {}) {
  const { internacion = null, medicoActivo = true } = opts;
  const bus = new EventBus();
  const notificaciones = {
    notificarUsuarios: vi.fn().mockResolvedValue(undefined),
    notificarPorRol: vi.fn().mockResolvedValue(undefined),
  };
  const pacientes = { get: vi.fn().mockResolvedValue({ nombre: 'Carlos', apellido: 'López' }) };
  const usuarios = { findOne: vi.fn().mockResolvedValue(medicoActivo && internacion ? { id: internacion.medicoId } : null) };
  const internaciones = { findOne: vi.fn().mockResolvedValue(internacion) };
  const subscriber = new VitalSignAlertSubscriber(
    bus,
    notificaciones as never,
    pacientes as never,
    usuarios as never,
    internaciones as never,
  );
  subscriber.onModuleInit();
  return { bus, notificaciones, internaciones, subscriber };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('VitalSignAlertSubscriber', () => {
  it('con internación activa notifica con prioridad ALTA solo al médico responsable', async () => {
    const { bus, notificaciones } = build({ internacion: { medicoId: 'm1' } });
    bus.publish(new VitalSignAlert(payload()));
    await flush();
    expect(notificaciones.notificarPorRol).not.toHaveBeenCalled();
    expect(notificaciones.notificarUsuarios).toHaveBeenCalledTimes(1);
    const [ids, contenido] = notificaciones.notificarUsuarios.mock.calls[0];
    expect(ids).toEqual(['m1']);
    expect(contenido).toMatchObject({ prioridad: 'ALTA', tipo: 'SIGNOS_VITALES_ALERTA' });
    expect(contenido.mensaje).toContain('Carlos López');
  });

  it('sin internación activa notifica a todos los médicos activos', async () => {
    const { bus, notificaciones } = build();
    bus.publish(new VitalSignAlert(payload()));
    await flush();
    expect(notificaciones.notificarUsuarios).not.toHaveBeenCalled();
    expect(notificaciones.notificarPorRol).toHaveBeenCalledWith(
      RolUsuario.MEDICO,
      expect.objectContaining({ prioridad: 'ALTA', tipo: 'SIGNOS_VITALES_ALERTA' }),
    );
  });

  it('con internación activa cuyo médico no está activo cae al respaldo de todos los médicos activos', async () => {
    const { bus, notificaciones } = build({ internacion: { medicoId: 'm1' }, medicoActivo: false });
    bus.publish(new VitalSignAlert(payload()));
    await flush();
    expect(notificaciones.notificarUsuarios).not.toHaveBeenCalled();
    expect(notificaciones.notificarPorRol).toHaveBeenCalledWith(RolUsuario.MEDICO, expect.anything());
  });

  it('ignora alertas que no son de temperatura crítica', async () => {
    const { bus, notificaciones } = build();
    bus.publish(new VitalSignAlert(payload({ tipo: 'FRECUENCIA_CARDIACA', valor: 180, unidad: 'lpm' })));
    bus.publish(new VitalSignAlert(payload({ valor: 39 })));
    bus.publish(new VitalSignAlert(payload({ valor: 38.5 })));
    await flush();
    expect(notificaciones.notificarUsuarios).not.toHaveBeenCalled();
    expect(notificaciones.notificarPorRol).not.toHaveBeenCalled();
  });

  it('no propaga errores al bus si falla la base', async () => {
    const { subscriber, internaciones } = build();
    internaciones.findOne.mockRejectedValue(new Error('db caída'));
    await expect(subscriber.handle(new VitalSignAlert(payload()))).resolves.toBeUndefined();
  });
});
