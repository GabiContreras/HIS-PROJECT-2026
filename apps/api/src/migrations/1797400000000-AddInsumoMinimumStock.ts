import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInsumoMinimumStock1797400000000
  implements MigrationInterface
{
  name = 'AddInsumoMinimumStock1797400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE insumos
      ADD COLUMN IF NOT EXISTS stock_minimo INTEGER NOT NULL DEFAULT 0;
    `);

    await queryRunner.query(`
      ALTER TABLE insumos
      DROP CONSTRAINT IF EXISTS ck_insumos_stock_minimo_no_negativo;
    `);

    await queryRunner.query(`
      ALTER TABLE insumos
      ADD CONSTRAINT ck_insumos_stock_minimo_no_negativo
      CHECK (stock_minimo >= 0);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE insumos
      DROP CONSTRAINT IF EXISTS ck_insumos_stock_minimo_no_negativo;
    `);

    await queryRunner.query(`
      ALTER TABLE insumos
      DROP COLUMN IF EXISTS stock_minimo;
    `);
  }
}
