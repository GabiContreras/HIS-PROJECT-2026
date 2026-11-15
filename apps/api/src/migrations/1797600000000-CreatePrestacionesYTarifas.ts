import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePrestacionesYTarifas1797600000000
  implements MigrationInterface
{
  name = 'CreatePrestacionesYTarifas1797600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS prestaciones (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        codigo varchar(50) NOT NULL,
        nombre varchar(100) NOT NULL,
        valor_base_pesos integer NOT NULL,
        copago_pesos integer NOT NULL,
        activo boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_prestaciones_codigo UNIQUE (codigo),
        CONSTRAINT ck_prestaciones_valor_base_no_negativo CHECK (valor_base_pesos >= 0),
        CONSTRAINT ck_prestaciones_copago_no_negativo CHECK (copago_pesos >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tarifas (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        financiador_id uuid NOT NULL REFERENCES financiadores(id) ON DELETE RESTRICT,
        prestacion_id uuid NOT NULL REFERENCES prestaciones(id) ON DELETE RESTRICT,
        valor_pesos integer NOT NULL,
        copago_pesos integer NULL,
        activo boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_tarifas_financiador_prestacion UNIQUE (financiador_id, prestacion_id),
        CONSTRAINT ck_tarifas_valor_no_negativo CHECK (valor_pesos >= 0),
        CONSTRAINT ck_tarifas_copago_no_negativo CHECK (copago_pesos IS NULL OR copago_pesos >= 0)
      )
    `);
    await queryRunner.query(`
      INSERT INTO prestaciones (codigo, nombre, valor_base_pesos, copago_pesos)
      VALUES
        ('CONSULTA_REGULAR', 'Consulta regular', 15000, 3000),
        ('CONSULTA_URGENCIA', 'Consulta de urgencia', 25000, 3000)
      ON CONFLICT (codigo) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS tarifas`);
    await queryRunner.query(`DROP TABLE IF EXISTS prestaciones`);
  }
}
