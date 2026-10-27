import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClinicalEvents1791800000000 implements MigrationInterface {
  name = 'ClinicalEvents1791800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS eventos_clinicos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
        tipo VARCHAR(40) NOT NULL,
        detalle JSONB NOT NULL DEFAULT '{}',
        registrado_por_id UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_eventos_paciente_fecha
      ON eventos_clinicos (paciente_id, created_at DESC);

      CREATE OR REPLACE FUNCTION bloquear_modificacion_eventos()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RAISE EXCEPTION 'eventos_clinicos es de solo agregado';
      END;
      $$;

      DROP TRIGGER IF EXISTS trg_eventos_solo_agregado ON eventos_clinicos;

      CREATE TRIGGER trg_eventos_solo_agregado
      BEFORE UPDATE OR DELETE
      ON eventos_clinicos
      FOR EACH ROW
      EXECUTE FUNCTION bloquear_modificacion_eventos();

      ALTER TABLE eventos_clinicos
      ENABLE ROW LEVEL SECURITY;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_eventos_solo_agregado
      ON eventos_clinicos;

      DROP FUNCTION IF EXISTS bloquear_modificacion_eventos();

      DROP TABLE IF EXISTS eventos_clinicos CASCADE;
    `);
  }
}