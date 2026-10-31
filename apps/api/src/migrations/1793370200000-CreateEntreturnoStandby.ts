import { MigrationInterface, QueryRunner } from 'typeorm';

/** HU 1.3: cola de espera por médico y día; se promueve sola cuando alguien cancela. */
export class CreateEntreturnoStandby1793370200000 implements MigrationInterface {
  name = 'CreateEntreturnoStandby1793370200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE entreturno_standby (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        medico_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
        paciente_id uuid NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
        fecha date NOT NULL,
        estado varchar(20) NOT NULL DEFAULT 'EN_COLA',
        turno_id uuid REFERENCES turnos(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "CK_entreturno_standby_estado"
          CHECK (estado IN ('EN_COLA', 'ASIGNADO', 'RETIRADO'))
      )
    `);
    // Un paciente no puede estar dos veces en la misma cola.
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_standby_paciente_en_cola
        ON entreturno_standby (medico_id, paciente_id, fecha) WHERE estado = 'EN_COLA'
    `);
    await queryRunner.query(`
      CREATE INDEX idx_standby_cola
        ON entreturno_standby (medico_id, fecha, created_at) WHERE estado = 'EN_COLA'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE entreturno_standby`);
  }
}
