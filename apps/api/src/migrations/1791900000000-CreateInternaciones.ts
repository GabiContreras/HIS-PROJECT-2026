import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInternaciones1791900000000 implements MigrationInterface {
  name = 'CreateInternaciones1791900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE internaciones (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        paciente_id    UUID        NOT NULL,
        cama_id        UUID        NOT NULL,
        medico_id      UUID        NOT NULL,
        fecha_ingreso  TIMESTAMPTZ NOT NULL DEFAULT now(),
        fecha_egreso   TIMESTAMPTZ,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT fk_internaciones_paciente FOREIGN KEY (paciente_id)
          REFERENCES pacientes (id) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT fk_internaciones_cama FOREIGN KEY (cama_id)
          REFERENCES camas (id) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT fk_internaciones_medico FOREIGN KEY (medico_id)
          REFERENCES usuarios (id) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT ck_internaciones_fechas CHECK (
          fecha_egreso IS NULL OR fecha_egreso > fecha_ingreso
        )
      );

      -- Índice único parcial para evitar que una cama tenga dos internaciones activas a la vez
      CREATE UNIQUE INDEX idx_cama_activa_unica 
        ON internaciones (cama_id) 
        WHERE fecha_egreso IS NULL;

      
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS internaciones CASCADE;`);
  }

  
}

