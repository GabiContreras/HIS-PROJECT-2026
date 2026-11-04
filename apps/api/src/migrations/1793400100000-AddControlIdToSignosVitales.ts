import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * HU 1.1: un control de signos vitales (presión, frecuencia cardíaca y temperatura) es un solo registro.
 * La tabla sigue guardando un valor por tipo; `control_id` agrupa los valores de un mismo control.
 * Los registros anteriores (sin control) quedan con `control_id` nulo.
 */
export class AddControlIdToSignosVitales1793400100000 implements MigrationInterface {
  name = 'AddControlIdToSignosVitales1793400100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE signos_vitales ADD COLUMN IF NOT EXISTS control_id uuid`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_signos_control_id ON signos_vitales (control_id) WHERE control_id IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_signos_control_id`);
    await queryRunner.query(`ALTER TABLE signos_vitales DROP COLUMN IF EXISTS control_id`);
  }
}
