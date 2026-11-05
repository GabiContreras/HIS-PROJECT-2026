import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * HCE: admite la categoría NOTA_ENFERMERIA en registros_clinicos (nota automática al registrar un control de signos vitales).
 * Idempotente: solo reemplaza el CHECK de categorías si la tabla existe, y no toca ningún dato.
 * `down` vuelve al CHECK anterior sin validar las filas existentes (los registros son inmutables y no se borran).
 */
export class AddNotaEnfermeriaToRegistrosClinicos1793400200000 implements MigrationInterface {
  name = 'AddNotaEnfermeriaToRegistrosClinicos1793400200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('registros_clinicos') IS NOT NULL THEN
          ALTER TABLE registros_clinicos DROP CONSTRAINT IF EXISTS ck_registros_clinicos_categoria;
          ALTER TABLE registros_clinicos ADD CONSTRAINT ck_registros_clinicos_categoria
            CHECK (categoria IN ('ALERGIA', 'ANTECEDENTE_FAMILIAR', 'EVOLUCION', 'ESTUDIO', 'NOTA_ENFERMERIA'));
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('registros_clinicos') IS NOT NULL THEN
          ALTER TABLE registros_clinicos DROP CONSTRAINT IF EXISTS ck_registros_clinicos_categoria;
          ALTER TABLE registros_clinicos ADD CONSTRAINT ck_registros_clinicos_categoria
            CHECK (categoria IN ('ALERGIA', 'ANTECEDENTE_FAMILIAR', 'EVOLUCION', 'ESTUDIO')) NOT VALID;
        END IF;
      END $$;
    `);
  }
}
