import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum OutboxStatus {
  PENDIENTE = 'PENDIENTE',
  PROCESADO = 'PROCESADO',
  FALLIDO = 'FALLIDO',
}

@Entity('outbox_events')
export class OutboxEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  eventType: string;

  @Column({ name: 'payload', type: 'jsonb' })
  payload: unknown;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;

  @Column({ name: 'correlation_id', type: 'varchar', length: 100, nullable: true })
  correlationId: string | null;

  @Column({ name: 'status', type: 'varchar', length: 20, default: OutboxStatus.PENDIENTE })
  status: OutboxStatus;

  @Column({ name: 'delivered_consumers', type: 'text', array: true, default: () => "'{}'" })
  deliveredConsumers: string[];

  @Column({ name: 'attempts', type: 'integer', default: 0 })
  attempts: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @Column({ name: 'next_attempt_at', type: 'timestamptz' })
  nextAttemptAt: Date;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
