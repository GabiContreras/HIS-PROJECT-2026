import { Inject, Injectable, Logger } from '@nestjs/common';
import type { DomainEvent } from '../domain-event.js';
import {
  DURABLE_EVENT_TYPES,
  OUTBOX_BATCH_SIZE,
  OUTBOX_INITIAL_GRACE_MS,
  OUTBOX_MAX_ATTEMPTS,
  OUTBOX_RETRY_BASE_DELAY_MS,
  OUTBOX_RETRY_MAX_DELAY_MS,
} from './outbox.config.js';
import { OUTBOX_STORE } from './outbox.types.js';
import type { OutboxConsumer, OutboxRecord, OutboxStore } from './outbox.types.js';

export function retryDelayMs(attempts: number): number {
  return Math.min(OUTBOX_RETRY_BASE_DELAY_MS * 2 ** (attempts - 1), OUTBOX_RETRY_MAX_DELAY_MS);
}

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);
  private readonly consumers: OutboxConsumer[] = [];

  constructor(@Inject(OUTBOX_STORE) private readonly store: OutboxStore) {}

  registerConsumer(consumer: OutboxConsumer): void {
    this.consumers.push(consumer);
  }

  unregisterConsumer(name: string): void {
    const index = this.consumers.findIndex((consumer) => consumer.name === name);
    if (index >= 0) this.consumers.splice(index, 1);
  }

  isDurable(eventType: string): boolean {
    return DURABLE_EVENT_TYPES.has(eventType);
  }

  async enqueue(event: DomainEvent): Promise<void> {
    const record = await this.persist(event);
    if (!record) {
      await this.deliverWithoutPersistence(event);
      return;
    }
    await this.dispatch(record);
  }

  async processDue(now: Date = new Date()): Promise<number> {
    const due = await this.store.findDue(now, OUTBOX_BATCH_SIZE);
    for (const record of due) {
      await this.dispatch(record);
    }
    return due.length;
  }

  private async persist(event: DomainEvent): Promise<OutboxRecord | null> {
    try {
      return await this.store.append({
        event,
        nextAttemptAt: new Date(Date.now() + OUTBOX_INITIAL_GRACE_MS),
      });
    } catch (error) {
      this.logger.error(
        `No se pudo persistir el evento ${event.type} en el outbox; se entrega solo en memoria.`,
        error instanceof Error ? error.stack : undefined,
      );
      return null;
    }
  }

  private consumersFor(eventType: string): OutboxConsumer[] {
    return this.consumers.filter((consumer) => consumer.eventType === eventType);
  }

  private async dispatch(record: OutboxRecord): Promise<void> {
    const consumers = this.consumersFor(record.event.type);
    if (consumers.length === 0) return;
    const expectedConsumers = consumers.map((consumer) => consumer.name);
    const failures: string[] = [];
    for (const consumer of consumers) {
      const failure = await this.deliverTo(record, consumer, expectedConsumers);
      if (failure) failures.push(failure);
    }
    if (failures.length > 0) {
      await this.registerFailure(record, failures.join(' | '));
    }
  }

  private async deliverTo(
    record: OutboxRecord,
    consumer: OutboxConsumer,
    expectedConsumers: string[],
  ): Promise<string | null> {
    try {
      await this.store.deliverOnce(record.id, consumer.name, expectedConsumers, (manager) =>
        consumer.handle(record.event, manager),
      );
      return null;
    } catch (error) {
      this.logger.error(
        `Falló la entrega del evento ${record.id} a ${consumer.name}.`,
        error instanceof Error ? error.stack : undefined,
      );
      return `${consumer.name}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async registerFailure(record: OutboxRecord, message: string): Promise<void> {
    const attempts = record.attempts + 1;
    try {
      await this.store.recordFailure(record.id, {
        message,
        attempts,
        nextAttemptAt: new Date(Date.now() + retryDelayMs(attempts)),
        exhausted: attempts >= OUTBOX_MAX_ATTEMPTS,
      });
    } catch (error) {
      this.logger.error(
        `No se pudo registrar el fallo del evento ${record.id}.`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async deliverWithoutPersistence(event: DomainEvent): Promise<void> {
    for (const consumer of this.consumersFor(event.type)) {
      try {
        await consumer.handle(event);
      } catch (error) {
        this.logger.error(
          `Falló la entrega en memoria de ${event.type} a ${consumer.name}.`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }
}
