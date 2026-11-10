import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * HU 2.1 (Patrón Builder): protocolo de atención base generado al ingreso de un paciente.
 * Aditiva: solo crea tablas nuevas; `down` las elimina.
 */
export class CreateProtocolosIngreso1792800000000 implements MigrationInterface {
  name = 'CreateProtocolosIngreso1792800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE protocolos_ingreso (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ingreso_id     UUID        NOT NULL,
        paciente_id    UUID        NOT NULL,
        tipo           VARCHAR     NOT NULL,
        motivo_ingreso TEXT        NOT NULL,
        generado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_protocolos_ingreso_ingreso UNIQUE (ingreso_id),
        CONSTRAINT ck_protocolos_ingreso_tipo CHECK (tipo IN ('PRE_QUIRURGICO', 'RESPIRATORIO')),
        CONSTRAINT fk_protocolos_ingreso_paciente FOREIGN KEY (paciente_id)
          REFERENCES pacientes (id) ON DELETE CASCADE ON UPDATE CASCADE
      );
      CREATE INDEX idx_protocolos_ingreso_paciente ON protocolos_ingreso (paciente_id, generado_en DESC);

      CREATE TABLE tareas_protocolo (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        protocolo_id     UUID NOT NULL,
        orden            INT  NOT NULL,
        descripcion      TEXT NOT NULL,
        frecuencia_horas INT,
        CONSTRAINT uq_tareas_protocolo_orden UNIQUE (protocolo_id, orden),
        CONSTRAINT ck_tareas_protocolo_frecuencia CHECK (frecuencia_horas IS NULL OR frecuencia_horas >= 1),
        CONSTRAINT fk_tareas_protocolo_protocolo FOREIGN KEY (protocolo_id)
          REFERENCES protocolos_ingreso (id) ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS tareas_protocolo;
      DROP TABLE IF EXISTS protocolos_ingreso;
    `);
  }
}
