import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBillingCharges1792596068 implements MigrationInterface {
  name = 'CreateBillingCharges1792596068';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE cargos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        turno_id UUID NOT NULL REFERENCES turnos(id) ON DELETE RESTRICT,
        importe_pesos INTEGER NOT NULL,
        tipo_atencion VARCHAR(20) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_cargos_turno_id UNIQUE (turno_id),
        CONSTRAINT ck_cargos_importe_positivo CHECK (importe_pesos > 0),
        CONSTRAINT ck_cargos_tipo_atencion
          CHECK (tipo_atencion IN ('REGULAR', 'URGENCIA'))
      );

      CREATE INDEX idx_cargos_created_at
      ON cargos (created_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS cargos;
    `);
  }
}
