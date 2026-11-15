import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEspecialidades1795200000000 implements MigrationInterface {
  name = 'CreateEspecialidades1795200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS especialidades (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre varchar(100) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_especialidades_nombre ON especialidades (LOWER(nombre))`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS medico_especialidad (
        medico_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        especialidad_id uuid NOT NULL REFERENCES especialidades(id) ON DELETE RESTRICT,
        PRIMARY KEY (medico_id, especialidad_id)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_medico_especialidad_esp ON medico_especialidad (especialidad_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_medico_especialidad_esp`);
    await queryRunner.query(`DROP TABLE IF EXISTS medico_especialidad`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_especialidades_nombre`);
    await queryRunner.query(`DROP TABLE IF EXISTS especialidades`);
  }
}