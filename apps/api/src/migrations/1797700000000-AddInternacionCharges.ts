import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInternacionCharges1797700000000 implements MigrationInterface {
  name = 'AddInternacionCharges1797700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cargos
      ADD COLUMN IF NOT EXISTS internacion_id uuid
    `);
    await queryRunner.query(`
      ALTER TABLE cargos DROP CONSTRAINT IF EXISTS fk_cargos_internacion
    `);
    await queryRunner.query(`
      ALTER TABLE cargos
      ADD CONSTRAINT fk_cargos_internacion
      FOREIGN KEY (internacion_id) REFERENCES internaciones(id) ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_cargos_internacion_id
      ON cargos (internacion_id)
      WHERE internacion_id IS NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE cargos
      DROP CONSTRAINT IF EXISTS ck_cargos_tipo_atencion,
      DROP CONSTRAINT IF EXISTS ck_cargos_origen,
      DROP CONSTRAINT IF EXISTS ck_cargos_tipo_origen
    `);
    await queryRunner.query(`
      ALTER TABLE cargos
      ADD CONSTRAINT ck_cargos_tipo_atencion
      CHECK (tipo_atencion IN ('REGULAR', 'URGENCIA', 'FARMACIA', 'INTERNACION'))
    `);
    await queryRunner.query(`
      ALTER TABLE cargos
      ADD CONSTRAINT ck_cargos_origen
      CHECK (num_nonnulls(turno_id, administration_id, internacion_id) = 1)
    `);
    await queryRunner.query(`
      ALTER TABLE cargos
      ADD CONSTRAINT ck_cargos_tipo_origen
      CHECK (
        (
          tipo_atencion = 'FARMACIA'
          AND turno_id IS NULL
          AND administration_id IS NOT NULL
          AND internacion_id IS NULL
          AND concepto = 'Insumos de Farmacia'
        )
        OR
        (
          tipo_atencion IN ('REGULAR', 'URGENCIA')
          AND turno_id IS NOT NULL
          AND administration_id IS NULL
          AND internacion_id IS NULL
        )
        OR
        (
          tipo_atencion = 'INTERNACION'
          AND turno_id IS NULL
          AND administration_id IS NULL
          AND internacion_id IS NOT NULL
        )
      )
    `);
    await queryRunner.query(`
      INSERT INTO prestaciones (codigo, nombre, valor_base_pesos, copago_pesos)
      VALUES ('DIA_CAMA', 'Día de cama', 50000, 3000)
      ON CONFLICT (codigo) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM tarifas
      WHERE prestacion_id IN (SELECT id FROM prestaciones WHERE codigo = 'DIA_CAMA')
    `);
    await queryRunner.query(`
      DELETE FROM prestaciones WHERE codigo = 'DIA_CAMA'
    `);
    await queryRunner.query(`
      ALTER TABLE cargos
      DROP CONSTRAINT IF EXISTS ck_cargos_tipo_origen,
      DROP CONSTRAINT IF EXISTS ck_cargos_origen,
      DROP CONSTRAINT IF EXISTS ck_cargos_tipo_atencion
    `);
    await queryRunner.query(`
      ALTER TABLE cargos
      ADD CONSTRAINT ck_cargos_tipo_atencion
      CHECK (tipo_atencion IN ('REGULAR', 'URGENCIA', 'FARMACIA'))
    `);
    await queryRunner.query(`
      ALTER TABLE cargos
      ADD CONSTRAINT ck_cargos_origen
      CHECK (
        (turno_id IS NOT NULL AND administration_id IS NULL)
        OR
        (turno_id IS NULL AND administration_id IS NOT NULL)
      )
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
      )
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_cargos_internacion_id
    `);
    await queryRunner.query(`
      ALTER TABLE cargos DROP CONSTRAINT IF EXISTS fk_cargos_internacion
    `);
    await queryRunner.query(`
      ALTER TABLE cargos DROP COLUMN IF EXISTS internacion_id
    `);
  }
}
