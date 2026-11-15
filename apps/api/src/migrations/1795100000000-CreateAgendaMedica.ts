import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAgendaMedica1795100000000 implements MigrationInterface {
  name = 'CreateAgendaMedica1795100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS agenda_medico (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        medico_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
        hora_inicio time NOT NULL,
        hora_fin time NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_agenda_medico_horas CHECK (hora_inicio < hora_fin)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_agenda_medico_medico ON agenda_medico (medico_id, dia_semana)`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS agenda_excepcion (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        medico_id uuid NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        fecha date NOT NULL,
        tipo varchar(20) NOT NULL CHECK (tipo IN ('AUSENCIA', 'FERIADO')),
        motivo varchar(200) NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_agenda_excepcion
      ON agenda_excepcion (COALESCE(medico_id, '00000000-0000-0000-0000-000000000000'::uuid), fecha)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_agenda_excepcion`);
    await queryRunner.query(`DROP TABLE IF EXISTS agenda_excepcion`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_agenda_medico_medico`);
    await queryRunner.query(`DROP TABLE IF EXISTS agenda_medico`);
  }
}