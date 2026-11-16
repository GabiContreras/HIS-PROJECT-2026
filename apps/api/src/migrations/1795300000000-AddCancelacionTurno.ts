import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCancelacionTurno1795300000000 implements MigrationInterface {
  name = 'AddCancelacionTurno1795300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE turnos ADD COLUMN IF NOT EXISTS motivo_cancelacion varchar(200) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE turnos ADD COLUMN IF NOT EXISTS cancelado_por_id uuid NULL REFERENCES usuarios(id) ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE turnos ADD COLUMN IF NOT EXISTS cancelado_en timestamptz NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE turnos DROP COLUMN IF EXISTS cancelado_en`);
    await queryRunner.query(`ALTER TABLE turnos DROP COLUMN IF EXISTS cancelado_por_id`);
    await queryRunner.query(`ALTER TABLE turnos DROP COLUMN IF EXISTS motivo_cancelacion`);
  }
}