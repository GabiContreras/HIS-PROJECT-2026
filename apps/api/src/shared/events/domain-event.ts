export interface DomainEvent<TPayload = unknown> {
  readonly type: string;
  readonly occurredAt: string;
  readonly payload: TPayload;
  readonly correlationId?: string;
}
