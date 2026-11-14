import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCargoEstado1797100000000 implements MigrationInterface {
  name = 'AddCargoEstado1797100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cargos
      ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE';
    `);

    await queryRunner.query(`
      ALTER TABLE cargos
      DROP CONSTRAINT IF EXISTS ck_cargos_estado;
    `);

    await queryRunner.query(`
      ALTER TABLE cargos
      ADD CONSTRAINT ck_cargos_estado
      CHECK (estado IN ('PENDIENTE', 'FACTURADO', 'PAGADO', 'ANULADO'));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cargos
      DROP CONSTRAINT IF EXISTS ck_cargos_estado;
    `);

    await queryRunner.query(`
      ALTER TABLE cargos
      DROP COLUMN IF EXISTS estado;
    `);
  }
}
