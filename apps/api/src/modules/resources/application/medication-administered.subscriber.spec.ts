import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { MedicationAdministered } from '../../../shared/events/medication-administered.event.js';
import { MedicationAdministeredSubscriber } from './medication-administered.subscriber.js';

const evento = (administrationId?: string) =>
  new MedicationAdministered({
    patientId: 'p-1',
    supplyId: 'supply-1',
    quantity: 1,
    administeredBy: 'nurse-1',
    administeredAt: '2030-01-01T14:10:00.000Z',
    administrationId,
  });

describe('MedicationAdministeredSubscriber', () => {
  let bus: EventBus;
  let inventory: { descontarStock: ReturnType<typeof vi.fn> };
  let subscriber: MedicationAdministeredSubscriber;

  beforeEach(() => {
    bus = new EventBus();
    inventory = {
      descontarStock: vi.fn().mockResolvedValue({ insumoId: 'supply-1', cantidadDescontada: 1, cantidadRestante: 9 }),
    };
    subscriber = new MedicationAdministeredSubscriber(bus, inventory as never);
    subscriber.onModuleInit();
  });

  it('descuenta 1 unidad del insumo al recibir el evento publicado en el bus', async () => {
    bus.publish(evento('adm-1'));
    await vi.waitFor(() => expect(inventory.descontarStock).toHaveBeenCalledTimes(1));
    expect(inventory.descontarStock).toHaveBeenCalledWith({ insumoId: 'supply-1', cantidad: 1 });
  });

  it('es idempotente: el mismo administrationId no descuenta dos veces', async () => {
    await subscriber.handle(evento('adm-1'));
    await subscriber.handle(evento('adm-1'));
    expect(inventory.descontarStock).toHaveBeenCalledTimes(1);
  });

  it('administraciones distintas descuentan cada una', async () => {
    await subscriber.handle(evento('adm-1'));
    await subscriber.handle(evento('adm-2'));
    expect(inventory.descontarStock).toHaveBeenCalledTimes(2);
  });

  it('sin administrationId descuenta siempre (limitación documentada)', async () => {
    await subscriber.handle(evento());
    await subscriber.handle(evento());
    expect(inventory.descontarStock).toHaveBeenCalledTimes(2);
  });

  it('stock insuficiente: no lanza hacia el bus y permite reintentar', async () => {
    inventory.descontarStock.mockRejectedValueOnce(new ConflictException('Stock insuficiente'));
    await expect(subscriber.handle(evento('adm-1'))).resolves.toBeUndefined();
    await subscriber.handle(evento('adm-1'));
    expect(inventory.descontarStock).toHaveBeenCalledTimes(2);
  });

  it('insumo inexistente o error inesperado: no lanza y el bus sigue funcionando', async () => {
    inventory.descontarStock.mockRejectedValueOnce(new NotFoundException('El insumo no existe'));
    inventory.descontarStock.mockRejectedValueOnce(new Error('db caída'));
    expect(() => bus.publish(evento('adm-1'))).not.toThrow();
    expect(() => bus.publish(evento('adm-2'))).not.toThrow();
    bus.publish(evento('adm-3'));
    await vi.waitFor(() => expect(inventory.descontarStock).toHaveBeenCalledTimes(3));
  });

  it('deja de escuchar al destruir el módulo', async () => {
    subscriber.onModuleDestroy();
    bus.publish(evento('adm-1'));
    await new Promise((r) => setTimeout(r, 10));
    expect(inventory.descontarStock).not.toHaveBeenCalled();
  });
});
