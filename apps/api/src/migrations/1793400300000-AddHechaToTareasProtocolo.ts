import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enfermería: el checklist del protocolo de ingreso pasa a ser permanente. Agrega a tareas_protocolo
 * `hecha`, `hecha_en` y `hecha_por_id` (quién y cuándo la marcó) y un CHECK que mantiene coherente `hecha` con `hecha_en`.
 * Idempotente: solo actúa si la tabla existe, usa ADD COLUMN IF NOT EXISTS y crea el CHECK solo si falta.
 * Las filas existentes quedan con hecha = false; no se pierde ningún dato.
 */
export class AddHechaToTareasProtocolo1793400300000 implements MigrationInterface {
  name = 'AddHechaToTareasProtocolo1793400300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('tareas_protocolo') IS NOT NULL THEN
          ALTER TABLE tareas_protocolo ADD COLUMN IF NOT EXISTS hecha boolean NOT NULL DEFAULT false;
          ALTER TABLE tareas_protocolo ADD COLUMN IF NOT EXISTS hecha_en timestamptz NULL;
          ALTER TABLE tareas_protocolo ADD COLUMN IF NOT EXISTS hecha_por_id uuid NULL
            REFERENCES usuarios(id) ON DELETE SET NULL ON UPDATE CASCADE;
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'ck_tareas_protocolo_hecha_coherente' AND conrelid = 'tareas_protocolo'::regclass
          ) THEN
            ALTER TABLE tareas_protocolo ADD CONSTRAINT ck_tareas_protocolo_hecha_coherente
              CHECK (hecha = (hecha_en IS NOT NULL));
          END IF;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('tareas_protocolo') IS NOT NULL THEN
          ALTER TABLE tareas_protocolo DROP CONSTRAINT IF EXISTS ck_tareas_protocolo_hecha_coherente;
          ALTER TABLE tareas_protocolo DROP COLUMN IF EXISTS hecha_por_id;
          ALTER TABLE tareas_protocolo DROP COLUMN IF EXISTS hecha_en;
          ALTER TABLE tareas_protocolo DROP COLUMN IF EXISTS hecha;
        END IF;
      END $$;
    `);
  }
}
