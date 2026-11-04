import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cobertura del paciente (HU de Facturación): obra social pública, medicina prepaga o particular.
 * Los pacientes existentes quedan como PARTICULAR hasta que administración cargue su cobertura.
 * Los cargos guardan una copia de la cobertura y del reparto paciente / tercero al momento de facturar.
 */
export class AddCoberturaToPacientesYCargos1793370300000
  implements MigrationInterface
{
  name = 'AddCoberturaToPacientesYCargos1793370300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE pacientes
        ADD COLUMN tipo_cobertura varchar(30) NOT NULL DEFAULT 'PARTICULAR',
        ADD COLUMN entidad_cobertura varchar(100),
        ADD CONSTRAINT ck_pacientes_tipo_cobertura
          CHECK (tipo_cobertura IN ('OBRA_SOCIAL_PUBLICA', 'MEDICINA_PREPAGA', 'PARTICULAR')),
        ADD CONSTRAINT ck_pacientes_cobertura_entidad CHECK (
          (tipo_cobertura = 'MEDICINA_PREPAGA' AND entidad_cobertura IS NOT NULL)
          OR (tipo_cobertura = 'PARTICULAR' AND entidad_cobertura IS NULL)
          OR tipo_cobertura = 'OBRA_SOCIAL_PUBLICA'
        )
    `);
    await queryRunner.query(`
      ALTER TABLE cargos
        ADD COLUMN tipo_cobertura varchar(30),
        ADD COLUMN entidad_cobertura varchar(100),
        ADD COLUMN importe_paciente_pesos integer,
        ADD COLUMN importe_tercero_pesos integer,
        ADD CONSTRAINT ck_cargos_importes_no_negativos CHECK (
          (importe_paciente_pesos IS NULL OR importe_paciente_pesos >= 0)
          AND (importe_tercero_pesos IS NULL OR importe_tercero_pesos >= 0)
        ),
        ADD CONSTRAINT ck_cargos_reparto_suma_importe CHECK (
          importe_paciente_pesos IS NULL OR importe_tercero_pesos IS NULL
          OR importe_paciente_pesos + importe_tercero_pesos = importe_pesos
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cargos
        DROP CONSTRAINT ck_cargos_reparto_suma_importe,
        DROP CONSTRAINT ck_cargos_importes_no_negativos,
        DROP COLUMN importe_tercero_pesos,
        DROP COLUMN importe_paciente_pesos,
        DROP COLUMN entidad_cobertura,
        DROP COLUMN tipo_cobertura
    `);
    await queryRunner.query(`
      ALTER TABLE pacientes
        DROP CONSTRAINT ck_pacientes_cobertura_entidad,
        DROP CONSTRAINT ck_pacientes_tipo_cobertura,
        DROP COLUMN entidad_cobertura,
        DROP COLUMN tipo_cobertura
    `);
  }
}
