import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * HCE: registros clínicos del paciente (alergias, antecedentes familiares, evoluciones médicas y estudios).
 * Aditiva: solo crea una tabla y su función/trigger nuevos; `down` los elimina.
 * La información es inmutable: el trigger rechaza cualquier UPDATE o DELETE.
 */
export class CreateRegistrosClinicos1792900000000 implements MigrationInterface {
  name = 'CreateRegistrosClinicos1792900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE registros_clinicos (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        paciente_id       UUID         NOT NULL,
        categoria         VARCHAR      NOT NULL,
        titulo            VARCHAR(120),
        detalle           TEXT         NOT NULL,
        registrado_por_id UUID         NOT NULL,
        fecha_hora        TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT ck_registros_clinicos_categoria CHECK (categoria IN ('ALERGIA', 'ANTECEDENTE_FAMILIAR', 'EVOLUCION', 'ESTUDIO')),
        CONSTRAINT ck_registros_clinicos_titulo CHECK (categoria = 'EVOLUCION' OR titulo IS NOT NULL),
        CONSTRAINT fk_registros_clinicos_paciente FOREIGN KEY (paciente_id)
          REFERENCES pacientes (id) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT fk_registros_clinicos_registrado_por FOREIGN KEY (registrado_por_id)
          REFERENCES usuarios (id) ON DELETE RESTRICT ON UPDATE CASCADE
      );
      CREATE INDEX idx_registros_clinicos_paciente ON registros_clinicos (paciente_id, fecha_hora DESC);

      CREATE FUNCTION registros_clinicos_inmutables() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'Los registros clínicos son inmutables: no se pueden modificar ni eliminar.';
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_registros_clinicos_inmutables
        BEFORE UPDATE OR DELETE ON registros_clinicos
        FOR EACH ROW EXECUTE FUNCTION registros_clinicos_inmutables();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_registros_clinicos_inmutables ON registros_clinicos;
      DROP FUNCTION IF EXISTS registros_clinicos_inmutables();
      DROP TABLE IF EXISTS registros_clinicos;
    `);
  }
}
