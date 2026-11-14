import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFinanciadoresYPlanes1797200000000
  implements MigrationInterface
{
  name = 'CreateFinanciadoresYPlanes1797200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS financiadores (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre varchar(100) NOT NULL,
        tipo varchar(30) NOT NULL,
        activo boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_financiadores_tipo
          CHECK (tipo IN ('OBRA_SOCIAL_PUBLICA', 'MEDICINA_PREPAGA'))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_financiadores_nombre ON financiadores (lower(nombre))`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS planes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        financiador_id uuid NOT NULL REFERENCES financiadores(id) ON DELETE RESTRICT,
        nombre varchar(100) NOT NULL,
        activo boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_planes_id_financiador UNIQUE (id, financiador_id)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_planes_financiador_nombre ON planes (financiador_id, lower(nombre))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_planes_financiador_nombre`);
    await queryRunner.query(`DROP TABLE IF EXISTS planes`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_financiadores_nombre`);
    await queryRunner.query(`DROP TABLE IF EXISTS financiadores`);
  }
}
