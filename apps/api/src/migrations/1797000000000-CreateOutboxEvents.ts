import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOutboxEvents1797000000000 implements MigrationInterface {
  name = 'CreateOutboxEvents1797000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS outbox_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type varchar(100) NOT NULL,
        payload jsonb NOT NULL,
        occurred_at timestamptz NOT NULL,
        correlation_id varchar(100),
        status varchar(20) NOT NULL DEFAULT 'PENDIENTE',
        delivered_consumers text[] NOT NULL DEFAULT '{}',
        attempts integer NOT NULL DEFAULT 0,
        last_error text,
        next_attempt_at timestamptz NOT NULL,
        processed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_outbox_events_status CHECK (status IN ('PENDIENTE', 'PROCESADO', 'FALLIDO')),
        CONSTRAINT ck_outbox_events_attempts CHECK (attempts >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_outbox_events_due
      ON outbox_events (next_attempt_at)
      WHERE status = 'PENDIENTE'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_outbox_events_due`);
    await queryRunner.query(`DROP TABLE IF EXISTS outbox_events`);
  }
}
