import type { DomainEvent } from './domain-event.js';

export abstract class IntegrationEvent<TPayload> implements DomainEvent<TPayload> {
  abstract readonly type: string;
  readonly occurredAt: string = new Date().toISOString();

  constructor(
    readonly payload: TPayload,
    readonly correlationId?: string,
  ) {}
}