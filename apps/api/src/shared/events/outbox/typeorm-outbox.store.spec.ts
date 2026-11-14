import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OutboxEvent, OutboxStatus } from '../../../entities/outbox-event.entity.js';
import { TypeOrmOutboxStore } from './typeorm-outbox.store.js';

const storedRow = (overrides: Partial<OutboxEvent> = {}): OutboxEvent =>
  ({
    id: 'outbox-1',
    eventType: 'medication.administered',
    payload: { administrationId: 'adm-1' },
    occurredAt: new Date('2030-01-01T10:00:00.000Z'),
    correlationId: null,
    status: OutboxStatus.PENDIENTE,
    deliveredConsumers: [],
    attempts: 0,
    lastError: null,
    nextAttemptAt: new Date('2030-01-01T10:00:30.000Z'),
    processedAt: null,
    createdAt: new Date('2030-01-01T10:00:00.000Z'),
    ...overrides,
  }) as OutboxEvent;

describe('TypeOrmOutboxStore', () => {
  let lockedRow: OutboxEvent | null;
  let manager: {
    createQueryBuilder: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let repository: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    manager: { transaction: ReturnType<typeof vi.fn> };
  };
  let store: TypeOrmOutboxStore;
  let lockMode: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    lockedRow = storedRow();
    lockMode = vi.fn();
    const queryBuilder = {
      setLock: vi.fn((mode: string) => {
        lockMode(mode);
        return queryBuilder;
      }),
      where: vi.fn(() => queryBuilder),
      getOne: vi.fn(async () => lockedRow),
    };
    manager = {
      createQueryBuilder: vi.fn(() => queryBuilder),
      update: vi.fn().mockResolvedValue(undefined),
    };
    repository = {
      create: vi.fn((input: Partial<OutboxEvent>) => input),
      save: vi.fn(async (input: Partial<OutboxEvent>) => storedRow(input)),
      update: vi.fn().mockResolvedValue(undefined),
      find: vi.fn(),
      manager: { transaction: vi.fn(async (work: (m: unknown) => Promise<unknown>) => work(manager)) },
    };
    store = new TypeOrmOutboxStore(repository as never);
  });

  it('guarda el evento y devuelve el registro', async () => {
    const event = {
      type: 'medication.administered',
      occurredAt: '2030-01-01T10:00:00.000Z',
      payload: { administrationId: 'adm-1' },
      correlationId: 'corr-1',
    };

    const record = await store.append({ event, nextAttemptAt: new Date('2030-01-01T10:00:30.000Z') });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: event.type, payload: event.payload, correlationId: 'corr-1' }),
    );
    expect(record.event).toMatchObject({ type: event.type, payload: event.payload, correlationId: 'corr-1' });
  });

  it('entrega bajo bloqueo pesimista y marca el consumidor dentro de la misma transacción', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);

    const outcome = await store.deliverOnce('outbox-1', 'billing', ['billing', 'inventory'], handler);

    expect(outcome).toBe('DELIVERED');
    expect(lockMode).toHaveBeenCalledWith('pessimistic_write');
    expect(handler).toHaveBeenCalledWith(manager);
    expect(manager.update).toHaveBeenCalledWith(OutboxEvent, 'outbox-1', { deliveredConsumers: ['billing'] });
  });

  it('marca el evento procesado cuando entregó todos los consumidores', async () => {
    lockedRow = storedRow({ deliveredConsumers: ['billing'] });

    await store.deliverOnce('outbox-1', 'inventory', ['billing', 'inventory'], vi.fn().mockResolvedValue(undefined));

    expect(manager.update).toHaveBeenCalledWith(
      OutboxEvent,
      'outbox-1',
      expect.objectContaining({
        deliveredConsumers: ['billing', 'inventory'],
        status: OutboxStatus.PROCESADO,
      }),
    );
  });

  it('no vuelve a ejecutar el efecto de un consumidor ya entregado', async () => {
    lockedRow = storedRow({ deliveredConsumers: ['billing'] });
    const handler = vi.fn();

    const outcome = await store.deliverOnce('outbox-1', 'billing', ['billing', 'inventory'], handler);

    expect(outcome).toBe('ALREADY_DELIVERED');
    expect(handler).not.toHaveBeenCalled();
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('si el efecto falla no marca la entrega y propaga el error para revertir la transacción', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('Stock insuficiente'));

    await expect(store.deliverOnce('outbox-1', 'inventory', ['inventory'], handler)).rejects.toThrow(
      'Stock insuficiente',
    );
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('registra el fallo con intentos, error y próximo intento', async () => {
    const nextAttemptAt = new Date('2030-01-01T10:05:00.000Z');

    await store.recordFailure('outbox-1', { message: 'billing: x', attempts: 2, nextAttemptAt, exhausted: false });
    await store.recordFailure('outbox-1', { message: 'billing: x', attempts: 10, nextAttemptAt, exhausted: true });

    expect(repository.update).toHaveBeenNthCalledWith(1, 'outbox-1', {
      attempts: 2,
      lastError: 'billing: x',
      nextAttemptAt,
      status: OutboxStatus.PENDIENTE,
    });
    expect(repository.update).toHaveBeenNthCalledWith(2, 'outbox-1', expect.objectContaining({ status: OutboxStatus.FALLIDO }));
  });

  it('busca los pendientes vencidos en orden de creación', async () => {
    repository.find.mockResolvedValue([storedRow({ deliveredConsumers: ['billing'], attempts: 3 })]);

    const due = await store.findDue(new Date(), 50);

    expect(repository.find).toHaveBeenCalledWith(expect.objectContaining({ order: { createdAt: 'ASC' }, take: 50 }));
    expect(due).toEqual([
      expect.objectContaining({ id: 'outbox-1', deliveredConsumers: ['billing'], attempts: 3 }),
    ]);
  });
});
