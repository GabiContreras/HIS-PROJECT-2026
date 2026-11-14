import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { InMemoryOutboxStore } from '../../../shared/events/outbox/in-memory-outbox.store.js';
import { OutboxService } from '../../../shared/events/outbox/outbox.service.js';
import { MedicationAdministered } from '../../../shared/events/medication-administered.event.js';
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
  let inventory: { descontarStock: ReturnType<typeof vi.fn> };
  let subscriber: MedicationAdministeredSubscriber;

  beforeEach(() => {
    store = new InMemoryOutboxStore();
    outbox = new OutboxService(store);
    bus = new EventBus(outbox);
    inventory = {
      descontarStock: vi.fn().mockResolvedValue({ insumoId: 'supply-1', cantidadDescontada: 2, cantidadRestante: 9 }),
    };
    subscriber = new MedicationAdministeredSubscriber(outbox, inventory as never);
    subscriber.onModuleInit();
  });

  it('descuenta la cantidad administrada al recibir el evento publicado en el bus', async () => {
    bus.publish(evento('adm-1'));

    await vi.waitFor(() => expect(inventory.descontarStock).toHaveBeenCalledTimes(1));
    expect(inventory.descontarStock).toHaveBeenCalledWith({ insumoId: 'supply-1', cantidad: 2 }, undefined);
  });

  it('entrega el manager de la transacción para que el descuento y la marca de entrega sean atómicos', async () => {
    const manager = {} as never;

    await subscriber.handle(evento('adm-1'), manager);

    expect(inventory.descontarStock).toHaveBeenCalledWith({ insumoId: 'supply-1', cantidad: 2 }, manager);
  });

  it('es idempotente: el mismo evento persistido no descuenta dos veces', async () => {
    bus.publish(evento('adm-1'));
    await vi.waitFor(() => expect(inventory.descontarStock).toHaveBeenCalledTimes(1));
    store.records[0].pending = true;

    await outbox.processDue(new Date(Date.now() + 3_600_000));

    expect(inventory.descontarStock).toHaveBeenCalledTimes(1);
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

  it('deja de recibir eventos al destruir el módulo', async () => {
    subscriber.onModuleDestroy();

    bus.publish(evento('adm-1'));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(inventory.descontarStock).not.toHaveBeenCalled();
  });
});
