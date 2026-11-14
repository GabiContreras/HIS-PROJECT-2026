import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea la tabla triajes (cola de espera de la guardia, HU Admisión 3.1).
 * Idempotente: CREATE TABLE / INDEX IF NOT EXISTS. No toca datos existentes.
 */
export class CreateTriajes1793900000000 implements MigrationInterface {
  name = 'CreateTriajes1793900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS triajes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        paciente_id uuid NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
        nivel varchar(20) NOT NULL,
        motivo_consulta text NOT NULL,
        estado varchar(20) NOT NULL DEFAULT 'EN_COLA',
        registrado_por_id uuid NOT NULL,
        medico_destino_id uuid,
        llegada_at timestamptz NOT NULL DEFAULT now(),
        atendido_at timestamptz,
        CONSTRAINT chk_triajes_nivel CHECK (nivel IN ('ROJO', 'NARANJA', 'AMARILLO', 'VERDE', 'AZUL')),
        CONSTRAINT chk_triajes_estado CHECK (estado IN ('EN_COLA', 'ATENDIDO'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_triajes_cola ON triajes (nivel, llegada_at) WHERE estado = 'EN_COLA'`,
    );
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_triajes_paciente ON triajes (paciente_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS triajes`);
  }
}
