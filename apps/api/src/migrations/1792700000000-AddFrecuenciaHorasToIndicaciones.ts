import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega la frecuencia estructurada (en horas) a indicaciones_medicas.
 *
 * - La columna de texto `frecuencia` se mantiene (texto legible, ej. "cada 8 horas").
 * - `frecuencia_horas` admite NULL: las filas anteriores no se adivinan ni se backfillean;
 *   confirmar una dosis de una indicación sin frecuencia estructurada devuelve un error claro.
 * - Es aditiva: el código viejo sigue funcionando contra la columna nueva.
 *   Al revés NO: el código nuevo falla si la columna todavía no existe en la base.
 */
export class AddFrecuenciaHorasToIndicaciones1792700000000 implements MigrationInterface {
  name = 'AddFrecuenciaHorasToIndicaciones1792700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE indicaciones_medicas
      ADD COLUMN IF NOT EXISTS frecuencia_horas INTEGER;

      ALTER TABLE indicaciones_medicas
      DROP CONSTRAINT IF EXISTS ck_indicaciones_frecuencia_horas;

      ALTER TABLE indicaciones_medicas
      ADD CONSTRAINT ck_indicaciones_frecuencia_horas
      CHECK (frecuencia_horas IS NULL OR frecuencia_horas > 0);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE indicaciones_medicas
      DROP CONSTRAINT IF EXISTS ck_indicaciones_frecuencia_horas;

      ALTER TABLE indicaciones_medicas
      DROP COLUMN IF EXISTS frecuencia_horas;
    `);
  }
}
