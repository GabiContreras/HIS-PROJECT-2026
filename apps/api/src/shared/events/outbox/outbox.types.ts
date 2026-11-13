import type { EntityManager } from 'typeorm';
import type { DomainEvent } from '../domain-event.js';

export interface OutboxRecord {
  id: string;
  event: DomainEvent;
  deliveredConsumers: string[];
  attempts: number;
}

export interface NewOutboxRecord {
  event: DomainEvent;
  nextAttemptAt: Date;
}

export interface DeliveryFailure {
  message: string;
  attempts: number;
  nextAttemptAt: Date;
  exhausted: boolean;
}

export type DeliveryHandler = (manager?: EntityManager) => Promise<void>;

export type DeliveryOutcome = 'DELIVERED' | 'ALREADY_DELIVERED';

export interface OutboxConsumer {
  name: string;
  eventType: string;
  handle: (event: DomainEvent, manager?: EntityManager) => Promise<void>;
}

export interface OutboxStore {
  append(record: NewOutboxRecord): Promise<OutboxRecord>;
  deliverOnce(
    recordId: string,
    consumerName: string,
    expectedConsumers: string[],
    handler: DeliveryHandler,
  ): Promise<DeliveryOutcome>;
  recordFailure(recordId: string, failure: DeliveryFailure): Promise<void>;
  findDue(now: Date, limit: number): Promise<OutboxRecord[]>;
}

export const OUTBOX_STORE = Symbol('OUTBOX_STORE');
