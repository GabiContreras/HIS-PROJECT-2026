import { MigrationInterface, QueryRunner } from 'typeorm';
export class AddInsumoPrice1793600000000
  implements MigrationInterface
{
  name = 'AddInsumoPrice1793600000000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE insumos
      ADD COLUMN precio_pesos INTEGER NOT NULL DEFAULT 0;
    `);
    await queryRunner.query(`
      ALTER TABLE insumos
      ADD CONSTRAINT ck_insumos_precio_no_negativo
      CHECK (precio_pesos >= 0);
    `);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE insumos
      DROP CONSTRAINT IF EXISTS ck_insumos_precio_no_negativo;
    `);
    await queryRunner.query(`
      ALTER TABLE insumos
      DROP COLUMN IF EXISTS precio_pesos;
    `);
  }
}
