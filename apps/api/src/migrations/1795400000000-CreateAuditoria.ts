import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditoria1795400000000 implements MigrationInterface {
  name = 'CreateAuditoria1795400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS auditoria (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        usuario_id uuid NULL,
        accion varchar(60) NOT NULL,
        recurso varchar(120) NOT NULL,
        paciente_id uuid NULL,
        metodo varchar(10) NOT NULL,
        ruta varchar(255) NOT NULL,
        estado_http integer NOT NULL,
        ip varchar(64) NULL,
        detalle varchar(255) NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS auditoria`);
  }
}
