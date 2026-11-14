import { randomUUID } from 'node:crypto';
import type {
  DeliveryFailure,
  DeliveryHandler,
  DeliveryOutcome,
  NewOutboxRecord,
  OutboxRecord,
  OutboxStore,
} from './outbox.types.js';

interface StoredRecord extends OutboxRecord {
  nextAttemptAt: Date;
  pending: boolean;
  lastError: string | null;
}

export class InMemoryOutboxStore implements OutboxStore {
  readonly records: StoredRecord[] = [];

  async append(record: NewOutboxRecord): Promise<OutboxRecord> {
    const stored: StoredRecord = {
      id: randomUUID(),
      event: record.event,
      deliveredConsumers: [],
      attempts: 0,
      nextAttemptAt: record.nextAttemptAt,
      pending: true,
      lastError: null,
    };
    this.records.push(stored);
    return stored;
  }

  async deliverOnce(
    recordId: string,
    consumerName: string,
    expectedConsumers: string[],
    handler: DeliveryHandler,
  ): Promise<DeliveryOutcome> {
    const stored = this.records.find((record) => record.id === recordId);
    if (!stored || stored.deliveredConsumers.includes(consumerName)) {
      return 'ALREADY_DELIVERED';
    }
    await handler();
    stored.deliveredConsumers.push(consumerName);
    stored.pending = !expectedConsumers.every((name) => stored.deliveredConsumers.includes(name));
    return 'DELIVERED';
  }

  async recordFailure(recordId: string, failure: DeliveryFailure): Promise<void> {
    const stored = this.records.find((record) => record.id === recordId);
    if (!stored) return;
    stored.attempts = failure.attempts;
    stored.lastError = failure.message;
    stored.nextAttemptAt = failure.nextAttemptAt;
    stored.pending = !failure.exhausted;
  }

  async findDue(now: Date, limit: number): Promise<OutboxRecord[]> {
    return this.records
      .filter((record) => record.pending && record.nextAttemptAt <= now)
      .slice(0, limit);
  }
}
