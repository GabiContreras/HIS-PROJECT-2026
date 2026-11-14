import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DomainEvent } from '../domain-event.js';
import { INTEGRATION_EVENTS } from '../integration-event-names.js';
import { InMemoryOutboxStore } from './in-memory-outbox.store.js';
import { OUTBOX_INITIAL_GRACE_MS, OUTBOX_MAX_ATTEMPTS } from './outbox.config.js';
import { OutboxService, retryDelayMs } from './outbox.service.js';
import type { OutboxStore } from './outbox.types.js';

const appointmentAttended: DomainEvent = {
  type: INTEGRATION_EVENTS.ADMISSIONS_APPOINTMENT_ATTENDED,
  occurredAt: '2030-01-01T10:00:00.000Z',
  payload: { appointmentId: 't-1', urgente: false },
};

const medicationAdministered: DomainEvent = {
  type: INTEGRATION_EVENTS.MEDICATION_ADMINISTERED,
  occurredAt: '2030-01-01T10:00:00.000Z',
  payload: { administrationId: 'adm-1' },
};

const afterGracePeriod = () => new Date(Date.now() + OUTBOX_INITIAL_GRACE_MS + 1_000);
const afterMaxBackoff = () => new Date(Date.now() + 3_600_000);

describe('OutboxService', () => {
  let store: InMemoryOutboxStore;
  let outbox: OutboxService;
  let billing: ReturnType<typeof vi.fn>;
  let inventory: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    store = new InMemoryOutboxStore();
    outbox = new OutboxService(store);
    billing = vi.fn().mockResolvedValue(undefined);
    inventory = vi.fn().mockResolvedValue(undefined);
    outbox.registerConsumer({
      name: 'billing',
      eventType: medicationAdministered.type,
      handle: billing,
    });
    outbox.registerConsumer({
      name: 'inventory',
      eventType: medicationAdministered.type,
      handle: inventory,
    });
  });

  it('reconoce solo los dos eventos durables', () => {
    expect(outbox.isDurable(INTEGRATION_EVENTS.ADMISSIONS_APPOINTMENT_ATTENDED)).toBe(true);
    expect(outbox.isDurable(INTEGRATION_EVENTS.MEDICATION_ADMINISTERED)).toBe(true);
    expect(outbox.isDurable(INTEGRATION_EVENTS.BED_ASSIGNED)).toBe(false);
    expect(outbox.isDurable(INTEGRATION_EVENTS.VITAL_SIGN_ALERT)).toBe(false);
  });

  it('persiste el evento y lo entrega a todos los consumidores', async () => {
    await outbox.enqueue(medicationAdministered);

    expect(store.records).toHaveLength(1);
    expect(store.records[0].event).toEqual(medicationAdministered);
    expect(billing).toHaveBeenCalledWith(medicationAdministered, undefined);
    expect(inventory).toHaveBeenCalledWith(medicationAdministered, undefined);
    expect(store.records[0].deliveredConsumers).toEqual(['billing', 'inventory']);
    expect(store.records[0].pending).toBe(false);
  });

  it('un consumidor que falla no bloquea a los demás y el evento queda pendiente', async () => {
    billing.mockRejectedValueOnce(new Error('db caída'));

    await outbox.enqueue(medicationAdministered);

    const [record] = store.records;
    expect(inventory).toHaveBeenCalledTimes(1);
    expect(record.deliveredConsumers).toEqual(['inventory']);
    expect(record.pending).toBe(true);
    expect(record.attempts).toBe(1);
    expect(record.lastError).toContain('billing: db caída');
  });

  it('el reintento solo entrega a los consumidores pendientes', async () => {
    billing.mockRejectedValueOnce(new Error('db caída'));
    await outbox.enqueue(medicationAdministered);

    const processed = await outbox.processDue(afterMaxBackoff());

    expect(processed).toBe(1);
    expect(billing).toHaveBeenCalledTimes(2);
    expect(inventory).toHaveBeenCalledTimes(1);
    expect(store.records[0].pending).toBe(false);
  });

  it('no reintenta antes de la fecha del próximo intento', async () => {
    billing.mockRejectedValueOnce(new Error('db caída'));
    await outbox.enqueue(medicationAdministered);

    await expect(outbox.processDue(new Date())).resolves.toBe(0);
    expect(billing).toHaveBeenCalledTimes(1);
  });

  it('un evento ya entregado no vuelve a procesarse', async () => {
    await outbox.enqueue(medicationAdministered);

    await expect(outbox.processDue(afterMaxBackoff())).resolves.toBe(0);
    expect(billing).toHaveBeenCalledTimes(1);
    expect(inventory).toHaveBeenCalledTimes(1);
  });

  it('procesar dos veces el mismo evento no duplica efectos', async () => {
    await outbox.enqueue(medicationAdministered);
    const [record] = store.records;
    record.pending = true;

    await outbox.processDue(afterMaxBackoff());

    expect(billing).toHaveBeenCalledTimes(1);
    expect(inventory).toHaveBeenCalledTimes(1);
  });

  it('recupera eventos persistidos antes de una caída', async () => {
    await store.append({ event: medicationAdministered, nextAttemptAt: new Date(0) });

    await expect(outbox.processDue()).resolves.toBe(1);

    expect(billing).toHaveBeenCalledTimes(1);
    expect(inventory).toHaveBeenCalledTimes(1);
  });

  it('el evento recién publicado no se procesa dos veces por el worker durante el período de gracia', async () => {
    await outbox.enqueue(medicationAdministered);
    store.records[0].pending = true;
    store.records[0].deliveredConsumers = [];

    await expect(outbox.processDue(new Date())).resolves.toBe(0);
    await expect(outbox.processDue(afterGracePeriod())).resolves.toBe(1);
  });

  it('deja de reintentar al agotar los intentos', async () => {
    billing.mockRejectedValue(new Error('siempre falla'));
    await outbox.enqueue(medicationAdministered);

    for (let attempt = 1; attempt < OUTBOX_MAX_ATTEMPTS; attempt++) {
      await outbox.processDue(afterMaxBackoff());
    }

    const [record] = store.records;
    expect(record.attempts).toBe(OUTBOX_MAX_ATTEMPTS);
    expect(record.pending).toBe(false);
    await expect(outbox.processDue(afterMaxBackoff())).resolves.toBe(0);
  });

  it('solo entrega a los consumidores del tipo de evento', async () => {
    await outbox.enqueue(appointmentAttended);

    expect(billing).not.toHaveBeenCalled();
    expect(inventory).not.toHaveBeenCalled();
    expect(store.records[0].pending).toBe(true);
  });

  it('si no se puede persistir, entrega en memoria sin lanzar error', async () => {
    const failingStore: OutboxStore = {
      append: vi.fn().mockRejectedValue(new Error('sin conexión')),
      deliverOnce: vi.fn(),
      recordFailure: vi.fn(),
      findDue: vi.fn(),
    };
    const degradedOutbox = new OutboxService(failingStore);
    degradedOutbox.registerConsumer({
      name: 'billing',
      eventType: medicationAdministered.type,
      handle: billing,
    });
    billing.mockRejectedValueOnce(new Error('también falla'));

    await expect(degradedOutbox.enqueue(medicationAdministered)).resolves.toBeUndefined();
    await expect(degradedOutbox.enqueue(medicationAdministered)).resolves.toBeUndefined();

    expect(billing).toHaveBeenCalledTimes(2);
    expect(failingStore.deliverOnce).not.toHaveBeenCalled();
  });

  it('un consumidor dado de baja deja de recibir eventos', async () => {
    outbox.unregisterConsumer('billing');

    await outbox.enqueue(medicationAdministered);

    expect(billing).not.toHaveBeenCalled();
    expect(inventory).toHaveBeenCalledTimes(1);
  });

  it('el retraso entre reintentos crece y tiene tope', () => {
    expect(retryDelayMs(2)).toBe(retryDelayMs(1) * 2);
    expect(retryDelayMs(OUTBOX_MAX_ATTEMPTS)).toBeLessThanOrEqual(300_000);
  });
});
