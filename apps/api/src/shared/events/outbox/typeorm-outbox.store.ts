import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { OutboxEvent, OutboxStatus } from '../../../entities/outbox-event.entity.js';
import type {
  DeliveryFailure,
  DeliveryHandler,
  DeliveryOutcome,
  NewOutboxRecord,
  OutboxRecord,
  OutboxStore,
} from './outbox.types.js';

@Injectable()
export class TypeOrmOutboxStore implements OutboxStore {
  constructor(
    @InjectRepository(OutboxEvent)
    private readonly repository: Repository<OutboxEvent>,
  ) {}

  async append(record: NewOutboxRecord): Promise<OutboxRecord> {
    const { event, nextAttemptAt } = record;
    const saved = await this.repository.save(
      this.repository.create({
        eventType: event.type,
        payload: event.payload,
        occurredAt: new Date(event.occurredAt),
        correlationId: event.correlationId ?? null,
        nextAttemptAt,
      }),
    );
    return toRecord(saved);
  }

  deliverOnce(
    recordId: string,
    consumerName: string,
    expectedConsumers: string[],
    handler: DeliveryHandler,
  ): Promise<DeliveryOutcome> {
    return this.repository.manager.transaction(async (manager) => {
      const row = await manager
        .createQueryBuilder(OutboxEvent, 'outbox')
        .setLock('pessimistic_write')
        .where('outbox.id = :recordId', { recordId })
        .getOne();
      if (!row || row.deliveredConsumers.includes(consumerName)) {
        return 'ALREADY_DELIVERED';
      }
      await handler(manager);
      const deliveredConsumers = [...row.deliveredConsumers, consumerName];
      const isComplete = expectedConsumers.every((name) => deliveredConsumers.includes(name));
      await manager.update(OutboxEvent, recordId, {
        deliveredConsumers,
        ...(isComplete ? { status: OutboxStatus.PROCESADO, processedAt: new Date(), lastError: null } : {}),
      });
      return 'DELIVERED';
    });
  }

  async recordFailure(recordId: string, failure: DeliveryFailure): Promise<void> {
    await this.repository.update(recordId, {
      attempts: failure.attempts,
      lastError: failure.message,
      nextAttemptAt: failure.nextAttemptAt,
      status: failure.exhausted ? OutboxStatus.FALLIDO : OutboxStatus.PENDIENTE,
    });
  }

  async findDue(now: Date, limit: number): Promise<OutboxRecord[]> {
    const rows = await this.repository.find({
      where: { status: OutboxStatus.PENDIENTE, nextAttemptAt: LessThanOrEqual(now) },
      order: { createdAt: 'ASC' },
      take: limit,
    });
    return rows.map(toRecord);
  }
}

function toRecord(row: OutboxEvent): OutboxRecord {
  return {
    id: row.id,
    event: {
      type: row.eventType,
      payload: row.payload,
      occurredAt: row.occurredAt.toISOString(),
      ...(row.correlationId ? { correlationId: row.correlationId } : {}),
    },
    deliveredConsumers: row.deliveredConsumers,
    attempts: row.attempts,
  };
}
