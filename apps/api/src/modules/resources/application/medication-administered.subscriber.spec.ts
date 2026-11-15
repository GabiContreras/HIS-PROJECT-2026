import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import type { DeliveryHandler, DeliveryOutcome } from '../../../shared/events/outbox/outbox.types.js';
import { InMemoryOutboxStore } from '../../../shared/events/outbox/in-memory-outbox.store.js';
import { OutboxService } from '../../../shared/events/outbox/outbox.service.js';
import { MedicationAdministered } from '../../../shared/events/medication-administered.event.js';
import { OrigenMovimientoInventario } from '../domain/inventory-movement.js';
import { MedicationAdministeredSubscriber } from './medication-administered.subscriber.js';

const evento = (administrationId?: string) =>
  new MedicationAdministered({
    patientId: 'p-1',
    supplyId: 'supply-1',
    quantity: 2,
    administeredBy: 'nurse-1',
    administeredAt: '2030-01-01T14:10:00.000Z',
    administrationId,
  });

describe('MedicationAdministeredSubscriber', () => {
  let bus: EventBus;
  let store: InMemoryOutboxStore;
  let outbox: OutboxService;
  let inventory: {
    descontarStock: ReturnType<typeof vi.fn>;
    descontarStockEnTransaccion: ReturnType<typeof vi.fn>;
  };
  let publicarAlerta: ReturnType<typeof vi.fn>;
  let subscriber: MedicationAdministeredSubscriber;

  beforeEach(() => {
    store = new InMemoryOutboxStore();
    outbox = new OutboxService(store);
    bus = new EventBus(outbox);
    publicarAlerta = vi.fn();
    inventory = {
      descontarStock: vi.fn().mockResolvedValue({ insumoId: 'supply-1', cantidadDescontada: 2, cantidadRestante: 9 }),
      descontarStockEnTransaccion: vi.fn().mockResolvedValue({
        resultado: { insumoId: 'supply-1', cantidadDescontada: 2, cantidadRestante: 9 },
        publicarAlerta,
      }),
    };
    subscriber = new MedicationAdministeredSubscriber(outbox, inventory as never);
    subscriber.onModuleInit();
  });

  it('descuenta la cantidad administrada al recibir el evento publicado en el bus', async () => {
    bus.publish(evento('adm-1'));

    await vi.waitFor(() => expect(inventory.descontarStock).toHaveBeenCalledTimes(1));
    expect(inventory.descontarStock).toHaveBeenCalledWith({
      insumoId: 'supply-1',
      cantidad: 2,
      usuarioId: null,
      origen: OrigenMovimientoInventario.ADMINISTRACION_MEDICACION,
      referenciaId: 'adm-1',
    });
  });

  it('entrega el manager de la transacción para que el descuento y la marca de entrega sean atómicos', async () => {
    const manager = {} as never;

    await subscriber.handle(evento('adm-1'), manager);

    expect(inventory.descontarStockEnTransaccion).toHaveBeenCalledWith(
      expect.objectContaining({ insumoId: 'supply-1', cantidad: 2 }),
      manager,
    );
    expect(inventory.descontarStock).not.toHaveBeenCalled();
  });

  it('con manager devuelve la alerta pendiente sin ejecutarla y sin manager no devuelve nada', async () => {
    const pendiente = await subscriber.handle(evento('adm-1'), {} as never);

    expect(pendiente).toBe(publicarAlerta);
    expect(publicarAlerta).not.toHaveBeenCalled();
    await expect(subscriber.handle(evento('adm-1'))).resolves.toBeUndefined();
  });

  it('es idempotente: el mismo evento persistido no descuenta dos veces', async () => {
    bus.publish(evento('adm-1'));
    await vi.waitFor(() => expect(inventory.descontarStock).toHaveBeenCalledTimes(1));
    store.records[0].pending = true;

    await outbox.processDue(new Date(Date.now() + 3_600_000));

    expect(inventory.descontarStock).toHaveBeenCalledTimes(1);
  });

  it('la reentrega del mismo evento no registra un segundo movimiento', async () => {
    const movimientos: Array<Record<string, unknown>> = [];
    inventory.descontarStock.mockImplementation(async (input: Record<string, unknown>) => {
      movimientos.push(input);
    });

    bus.publish(evento('adm-1'));
    await vi.waitFor(() => expect(movimientos).toHaveLength(1));
    store.records[0].pending = true;

    await outbox.processDue(new Date(Date.now() + 3_600_000));

    expect(movimientos).toHaveLength(1);
    expect(movimientos[0]).toMatchObject({
      usuarioId: null,
      origen: OrigenMovimientoInventario.ADMINISTRACION_MEDICACION,
      referenciaId: 'adm-1',
    });
  });

  it('sin administrationId en el evento la referencia es null', async () => {
    await subscriber.handle(evento());

    expect(inventory.descontarStock).toHaveBeenCalledWith(
      expect.objectContaining({ referenciaId: null }),
    );
  });

  it('administraciones distintas descuentan cada una', async () => {
    bus.publish(evento('adm-1'));
    bus.publish(evento('adm-2'));

    await vi.waitFor(() => expect(inventory.descontarStock).toHaveBeenCalledTimes(2));
  });

  it('stock insuficiente (409): el evento queda pendiente y se descuenta al reintentar', async () => {
    inventory.descontarStock.mockRejectedValueOnce(new ConflictException('Stock insuficiente'));

    bus.publish(evento('adm-1'));
    await vi.waitFor(() => expect(store.records[0]?.attempts).toBe(1));
    expect(store.records[0].pending).toBe(true);

    await outbox.processDue(new Date(Date.now() + 3_600_000));

    expect(inventory.descontarStock).toHaveBeenCalledTimes(2);
    expect(store.records[0].pending).toBe(false);
  });

  it('el handler propaga el 409 para que se revierta la transacción de entrega', async () => {
    inventory.descontarStock.mockRejectedValueOnce(new ConflictException('Stock insuficiente'));

    await expect(subscriber.handle(evento('adm-1'))).rejects.toBeInstanceOf(ConflictException);
  });

  it('insumo inexistente o error inesperado: publicar no lanza y el bus sigue funcionando', async () => {
    inventory.descontarStock.mockRejectedValueOnce(new NotFoundException('El insumo no existe'));
    inventory.descontarStock.mockRejectedValueOnce(new Error('db caída'));

    expect(() => bus.publish(evento('adm-1'))).not.toThrow();
    expect(() => bus.publish(evento('adm-2'))).not.toThrow();
    bus.publish(evento('adm-3'));

    await vi.waitFor(() => expect(inventory.descontarStock).toHaveBeenCalledTimes(3));
  });

  describe('alerta de stock mínimo con el manager del Outbox', () => {
    let log: string[];

    class ManagerStore extends InMemoryOutboxStore {
      async deliverOnce(
        recordId: string,
        consumerName: string,
        expectedConsumers: string[],
        handler: DeliveryHandler,
      ): Promise<DeliveryOutcome> {
        const outcome = await super.deliverOnce(recordId, consumerName, expectedConsumers, () =>
          handler({} as never),
        );
        log.push('commit');
        return outcome;
      }
    }

    beforeEach(() => {
      log = [];
      store = new ManagerStore();
      outbox = new OutboxService(store);
      bus = new EventBus(outbox);
      publicarAlerta.mockImplementation(() => {
        log.push('alerta');
      });
      subscriber = new MedicationAdministeredSubscriber(outbox, inventory as never);
      subscriber.onModuleInit();
    });

    it('publica la alerta una vez, después del commit de la entrega', async () => {
      bus.publish(evento('adm-1'));

      await vi.waitFor(() => expect(publicarAlerta).toHaveBeenCalledTimes(1));
      expect(log).toEqual(['commit', 'alerta']);
    });

    it('si el descuento falla y se revierte no publica la alerta', async () => {
      inventory.descontarStockEnTransaccion.mockRejectedValueOnce(new ConflictException('Stock insuficiente'));

      bus.publish(evento('adm-1'));
      await vi.waitFor(() => expect(store.records[0]?.attempts).toBe(1));

      expect(publicarAlerta).not.toHaveBeenCalled();
      expect(log).toEqual([]);
    });

    it('reentregar el mismo evento no repite el descuento ni la alerta', async () => {
      bus.publish(evento('adm-1'));
      await vi.waitFor(() => expect(publicarAlerta).toHaveBeenCalledTimes(1));
      store.records[0].pending = true;

      await outbox.processDue(new Date(Date.now() + 3_600_000));

      expect(inventory.descontarStockEnTransaccion).toHaveBeenCalledTimes(1);
      expect(publicarAlerta).toHaveBeenCalledTimes(1);
    });

    it('tras un fallo y un reintento exitoso publica la alerta una sola vez', async () => {
      inventory.descontarStockEnTransaccion.mockRejectedValueOnce(new Error('db caída'));

      bus.publish(evento('adm-1'));
      await vi.waitFor(() => expect(store.records[0]?.attempts).toBe(1));
      await outbox.processDue(new Date(Date.now() + 3_600_000));

      expect(publicarAlerta).toHaveBeenCalledTimes(1);
    });
  });

  it('deja de recibir eventos al destruir el módulo', async () => {
    subscriber.onModuleDestroy();

    bus.publish(evento('adm-1'));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(inventory.descontarStock).not.toHaveBeenCalled();
  });
});
