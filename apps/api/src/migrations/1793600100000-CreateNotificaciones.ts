import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea la tabla notificaciones que usa NotificacionEntity (alertas de triaje y de signos vitales).
 * Idempotente: CREATE TABLE / INDEX IF NOT EXISTS. No toca datos existentes.
 */
export class CreateNotificaciones1793600100000 implements MigrationInterface {
  name = 'CreateNotificaciones1793600100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notificaciones (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        destinatario_id varchar NOT NULL,
        tipo varchar NOT NULL,
        prioridad varchar NOT NULL DEFAULT 'MEDIA',
        mensaje text NOT NULL,
        leida boolean NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_notificaciones_destinatario ON notificaciones (destinatario_id, created_at DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS notificaciones`);
  }
}
