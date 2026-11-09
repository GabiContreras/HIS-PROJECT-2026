import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPharmacyCharges1793700000000
  implements MigrationInterface
{
  name = 'AddPharmacyCharges1793700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cargos
      ALTER COLUMN turno_id DROP NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE cargos
      ADD COLUMN administration_id UUID,
      ADD COLUMN concepto VARCHAR(100);
    `);

    await queryRunner.query(`
      ALTER TABLE cargos
      ADD CONSTRAINT fk_cargos_administration
      FOREIGN KEY (administration_id)
      REFERENCES administraciones_medicacion(id)
      ON DELETE RESTRICT;
    `);

    await queryRunner.query(`
      ALTER TABLE cargos
      DROP CONSTRAINT ck_cargos_tipo_atencion;
    `);

    await queryRunner.query(`
      ALTER TABLE cargos
      ADD CONSTRAINT ck_cargos_tipo_atencion
      CHECK (tipo_atencion IN ('REGULAR', 'URGENCIA', 'FARMACIA'));
    `);

    await queryRunner.query(`
      ALTER TABLE cargos
      ADD CONSTRAINT ck_cargos_origen
      CHECK (
        (turno_id IS NOT NULL AND administration_id IS NULL)
        OR
        (turno_id IS NULL AND administration_id IS NOT NULL)
      );
    `);
    await queryRunner.query(`
    CREATE UNIQUE INDEX uq_cargos_administration_id
    ON cargos (administration_id)
    WHERE administration_id IS NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE cargos
      ADD CONSTRAINT ck_cargos_concepto_farmacia
      CHECK (
        tipo_atencion <> 'FARMACIA'
        OR (
          administration_id IS NOT NULL
          AND concepto = 'Insumos de Farmacia'
        )
      );
    `);
    await queryRunner.query(`
      ALTER TABLE cargos
     ADD CONSTRAINT ck_cargos_tipo_origen
     CHECK (
      (
      tipo_atencion = 'FARMACIA'
      AND turno_id IS NULL
      AND administration_id IS NOT NULL
      AND concepto = 'Insumos de Farmacia'
     )
      OR
      (
      tipo_atencion IN ('REGULAR', 'URGENCIA')
      AND turno_id IS NOT NULL
      AND administration_id IS NULL
      )
     );
   `);
  }


  public async down(queryRunner: QueryRunner): Promise<void> {

    await queryRunner.query(`
    DROP INDEX IF EXISTS uq_cargos_administration_id;
    `);

    await queryRunner.query(`
     ALTER TABLE cargos
     DROP CONSTRAINT IF EXISTS ck_cargos_tipo_origen,
     DROP CONSTRAINT IF EXISTS ck_cargos_concepto_farmacia,
     DROP CONSTRAINT IF EXISTS ck_cargos_origen;
    `);

    await queryRunner.query(`
      ALTER TABLE cargos
      DROP CONSTRAINT IF EXISTS fk_cargos_administration;
    `);

    await queryRunner.query(`
      ALTER TABLE cargos
      DROP CONSTRAINT IF EXISTS ck_cargos_tipo_atencion;
    `);

    await queryRunner.query(`
      ALTER TABLE cargos
      ADD CONSTRAINT ck_cargos_tipo_atencion
      CHECK (tipo_atencion IN ('REGULAR', 'URGENCIA'));
    `);

    await queryRunner.query(`
      ALTER TABLE cargos
      DROP COLUMN IF EXISTS administration_id,
      DROP COLUMN IF EXISTS concepto;
    `);

    await queryRunner.query(`
      ALTER TABLE cargos
      ALTER COLUMN turno_id SET NOT NULL;
    `);
  }
}
