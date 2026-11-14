import { MigrationInterface, QueryRunner } from 'typeorm';

const addConstraintIfMissing = (
  queryRunner: QueryRunner,
  name: string,
  definition: string,
) =>
  queryRunner.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
        ALTER TABLE pacientes ADD CONSTRAINT ${name} ${definition};
      END IF;
    END
    $$
  `);

export class AddCoberturaCatalogoToPacientes1797300000000
  implements MigrationInterface
{
  name = 'AddCoberturaCatalogoToPacientes1797300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE pacientes
        ADD COLUMN IF NOT EXISTS financiador_id uuid,
        ADD COLUMN IF NOT EXISTS plan_id uuid,
        ADD COLUMN IF NOT EXISTS numero_afiliado varchar(30)
    `);
    await addConstraintIfMissing(
      queryRunner,
      'fk_pacientes_financiador',
      'FOREIGN KEY (financiador_id) REFERENCES financiadores(id) ON DELETE RESTRICT',
    );
    await addConstraintIfMissing(
      queryRunner,
      'fk_pacientes_plan_del_financiador',
      'FOREIGN KEY (plan_id, financiador_id) REFERENCES planes(id, financiador_id) ON DELETE RESTRICT',
    );
    await addConstraintIfMissing(
      queryRunner,
      'ck_pacientes_plan_requiere_financiador',
      'CHECK (plan_id IS NULL OR financiador_id IS NOT NULL)',
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_pacientes_financiador ON pacientes (financiador_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_pacientes_plan ON pacientes (plan_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_pacientes_plan`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_pacientes_financiador`);
    await queryRunner.query(`
      ALTER TABLE pacientes
        DROP CONSTRAINT IF EXISTS ck_pacientes_plan_requiere_financiador,
        DROP CONSTRAINT IF EXISTS fk_pacientes_plan_del_financiador,
        DROP CONSTRAINT IF EXISTS fk_pacientes_financiador,
        DROP COLUMN IF EXISTS numero_afiliado,
        DROP COLUMN IF EXISTS plan_id,
        DROP COLUMN IF EXISTS financiador_id
    `);
  }
}
