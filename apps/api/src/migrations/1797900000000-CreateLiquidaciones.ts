import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLiquidaciones1797900000000 implements MigrationInterface {
  name = 'CreateLiquidaciones1797900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS liquidaciones (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        financiador_id uuid NOT NULL REFERENCES financiadores(id) ON DELETE RESTRICT,
        periodo_desde date NOT NULL,
        periodo_hasta date NOT NULL,
        cantidad_cargos integer NOT NULL,
        total_pesos integer NOT NULL,
        usuario_id uuid NULL REFERENCES usuarios(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      ALTER TABLE cargos
      ADD COLUMN IF NOT EXISTS financiador_id uuid,
      ADD COLUMN IF NOT EXISTS liquidacion_id uuid
    `);
    await queryRunner.query(`
      ALTER TABLE cargos DROP CONSTRAINT IF EXISTS fk_cargos_financiador
    `);
    await queryRunner.query(`
      ALTER TABLE cargos
      ADD CONSTRAINT fk_cargos_financiador
      FOREIGN KEY (financiador_id) REFERENCES financiadores(id) ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE cargos DROP CONSTRAINT IF EXISTS fk_cargos_liquidacion
    `);
    await queryRunner.query(`
      ALTER TABLE cargos
      ADD CONSTRAINT fk_cargos_liquidacion
      FOREIGN KEY (liquidacion_id) REFERENCES liquidaciones(id) ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_cargos_financiador_created
      ON cargos (financiador_id, created_at)
      WHERE financiador_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_cargos_liquidacion
      ON cargos (liquidacion_id)
      WHERE liquidacion_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS ix_cargos_liquidacion`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_cargos_financiador_created`);
    await queryRunner.query(`
      ALTER TABLE cargos DROP CONSTRAINT IF EXISTS fk_cargos_liquidacion
    `);
    await queryRunner.query(`
      ALTER TABLE cargos DROP CONSTRAINT IF EXISTS fk_cargos_financiador
    `);
    await queryRunner.query(`
      ALTER TABLE cargos
      DROP COLUMN IF EXISTS liquidacion_id,
      DROP COLUMN IF EXISTS financiador_id
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS liquidaciones`);
  }
}
