import { describe, expect, it, vi } from 'vitest';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { StandbyPromoted, type StandbyPromotedPayload } from '../../../shared/events/standby-promoted.event.js';
import { StandbyPromotedSubscriber } from './standby-promoted.subscriber.js';

const payload = (over: Partial<StandbyPromotedPayload> = {}): StandbyPromotedPayload => ({
  appointmentId: 't2',
  doctorId: 'm1',
  patientId: 'p2',
  scheduledAt: '2030-05-20T13:30:00.000Z',
  ...over,
});

function build() {
  const bus = new EventBus();
  const notificaciones = { notificarPorRol: vi.fn().mockResolvedValue(undefined) };
  const pacientes = { get: vi.fn().mockResolvedValue({ nombre: 'Luis', apellido: 'Medina' }) };
  const usuarios = { findOneOrFail: vi.fn().mockResolvedValue({ nombre: 'Ana', apellido: 'Gómez' }) };
  const subscriber = new StandbyPromotedSubscriber(bus, notificaciones as never, pacientes as never, usuarios as never);
  subscriber.onModuleInit();
  return { bus, notificaciones, pacientes, usuarios, subscriber };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('StandbyPromotedSubscriber', () => {
  it('notifica a los ADMINISTRATIVO con médico, paciente y horario en hora de la clínica', async () => {
    const { bus, notificaciones } = build();
    bus.publish(new StandbyPromoted(payload()));
    await flush();
    expect(notificaciones.notificarPorRol).toHaveBeenCalledOnce();
    const [rol, contenido] = notificaciones.notificarPorRol.mock.calls[0];
    expect(rol).toBe(RolUsuario.ADMINISTRATIVO);
    expect(contenido).toMatchObject({ tipo: 'ESPERA_PROMOVIDA', prioridad: 'MEDIA' });
    expect(contenido.mensaje).toContain('Luis Medina');
    expect(contenido.mensaje).toContain('Ana Gómez');
    expect(contenido.mensaje).toContain('20/05/2030');
    expect(contenido.mensaje).toContain('10:30');
  });

  it('no propaga errores si falla la base', async () => {
    const { subscriber, usuarios, notificaciones } = build();
    usuarios.findOneOrFail.mockRejectedValue(new Error('db caída'));
    await expect(subscriber.handle(new StandbyPromoted(payload()))).resolves.toBeUndefined();
    expect(notificaciones.notificarPorRol).not.toHaveBeenCalled();
  });

  it('no propaga errores si falla el helper de notificaciones', async () => {
    const { subscriber, notificaciones } = build();
    notificaciones.notificarPorRol.mockRejectedValue(new Error('fallo'));
    await expect(subscriber.handle(new StandbyPromoted(payload()))).resolves.toBeUndefined();
  });
});
