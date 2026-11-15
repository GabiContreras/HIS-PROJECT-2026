import { describe, expect, it, vi } from 'vitest';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import {
  InventoryLowStock,
  type InventoryLowStockPayload,
} from '../../../shared/events/inventory-low-stock.event.js';
import { MedicationAdministered } from '../../../shared/events/medication-administered.event.js';
import { LowStockNotificationSubscriber } from './low-stock-notification.subscriber.js';

const payload = (over: Partial<InventoryLowStockPayload> = {}): InventoryLowStockPayload => ({
  insumoId: 'insumo-1',
  nombre: 'Aguja',
  unidadMedida: 'unidad',
  cantidadDisponible: 5,
  stockMinimo: 5,
  ...over,
});

function build() {
  const bus = new EventBus();
  const notificaciones = {
    notificarPorRol: vi.fn().mockResolvedValue(undefined),
    notificarUsuarios: vi.fn().mockResolvedValue(undefined),
  };
  const subscriber = new LowStockNotificationSubscriber(bus, notificaciones as never);
  subscriber.onModuleInit();
  return { bus, notificaciones, subscriber };
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('LowStockNotificationSubscriber', () => {
  it('notifica al rol ADMINISTRATIVO con tipo, prioridad y mensaje exactos', async () => {
    const { bus, notificaciones } = build();

    bus.publish(new InventoryLowStock(payload()));
    await flush();

    expect(notificaciones.notificarPorRol).toHaveBeenCalledTimes(1);
    expect(notificaciones.notificarPorRol).toHaveBeenCalledWith(RolUsuario.ADMINISTRATIVO, {
      tipo: 'STOCK_BAJO',
      prioridad: 'MEDIA',
      mensaje: 'Stock bajo: Aguja tiene 5 unidad (mínimo 5)',
    });
    expect(notificaciones.notificarUsuarios).not.toHaveBeenCalled();
  });

  it('arma el mensaje con los datos del evento', async () => {
    const { bus, notificaciones } = build();

    bus.publish(
      new InventoryLowStock(
        payload({ nombre: 'Gasa', unidadMedida: 'paquete', cantidadDisponible: 0, stockMinimo: 10 }),
      ),
    );
    await flush();

    expect(notificaciones.notificarPorRol.mock.calls[0][1].mensaje).toBe(
      'Stock bajo: Gasa tiene 0 paquete (mínimo 10)',
    );
  });

  it('ignora eventos de otros tipos', async () => {
    const { bus, notificaciones } = build();

    bus.publish(
      new MedicationAdministered({
        patientId: 'p-1',
        supplyId: 's-1',
        quantity: 1,
        administeredBy: 'n-1',
        administeredAt: '2030-01-01T14:10:00.000Z',
      }),
    );
    await flush();

    expect(notificaciones.notificarPorRol).not.toHaveBeenCalled();
  });

  it('no propaga errores del servicio de notificaciones', async () => {
    const { bus, notificaciones, subscriber } = build();
    notificaciones.notificarPorRol.mockRejectedValueOnce(new Error('db caída'));

    expect(() => bus.publish(new InventoryLowStock(payload()))).not.toThrow();
    await flush();
    await expect(subscriber.handle(new InventoryLowStock(payload()))).resolves.toBeUndefined();

    notificaciones.notificarPorRol.mockRejectedValueOnce('texto');
    await expect(subscriber.handle(new InventoryLowStock(payload()))).resolves.toBeUndefined();
  });

  it('sigue recibiendo eventos después de un fallo', async () => {
    const { bus, notificaciones } = build();
    notificaciones.notificarPorRol.mockRejectedValueOnce(new Error('db caída'));

    bus.publish(new InventoryLowStock(payload()));
    bus.publish(new InventoryLowStock(payload({ insumoId: 'insumo-2' })));
    await flush();

    expect(notificaciones.notificarPorRol).toHaveBeenCalledTimes(2);
  });

  it('deja de recibir eventos al destruir el módulo', async () => {
    const { bus, notificaciones, subscriber } = build();

    subscriber.onModuleDestroy();
    bus.publish(new InventoryLowStock(payload()));
    await flush();

    expect(notificaciones.notificarPorRol).not.toHaveBeenCalled();
  });
});
