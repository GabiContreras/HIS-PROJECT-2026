import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Recursos / Enfermería (HU 2.1 de Enfermería): guarda el motivo de ingreso informado al asignar la cama,
 * para publicar `patient.admitted` y que Enfermería genere el protocolo de atención.
 * Agrega `internaciones.motivo_ingreso` (varchar(200), opcional).
 * Idempotente: solo actúa si la tabla existe y usa ADD COLUMN IF NOT EXISTS.
 * Las internaciones existentes quedan con motivo_ingreso = NULL; no se pierde ningún dato.
 */
export class AddMotivoIngresoToInternaciones1794000000000 implements MigrationInterface {
  name = 'AddMotivoIngresoToInternaciones1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('internaciones') IS NOT NULL THEN
          ALTER TABLE internaciones ADD COLUMN IF NOT EXISTS motivo_ingreso varchar(200) NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('internaciones') IS NOT NULL THEN
          ALTER TABLE internaciones DROP COLUMN IF EXISTS motivo_ingreso;
        END IF;
      END $$;
    `);
  }
}
