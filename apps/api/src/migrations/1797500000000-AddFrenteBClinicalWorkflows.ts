import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFrenteBClinicalWorkflows1797500000000 implements MigrationInterface {
  name = 'AddFrenteBClinicalWorkflows1797500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE registros_clinicos
        ADD COLUMN IF NOT EXISTS corrige_a uuid,
        ADD COLUMN IF NOT EXISTS turno_id uuid,
        ADD COLUMN IF NOT EXISTS internacion_id uuid;
      ALTER TABLE registros_clinicos
        DROP CONSTRAINT IF EXISTS ck_registros_clinicos_categoria;
      ALTER TABLE registros_clinicos
        ADD CONSTRAINT ck_registros_clinicos_categoria
        CHECK (categoria IN ('ALERGIA', 'ANTECEDENTE_FAMILIAR', 'EVOLUCION', 'ESTUDIO', 'NOTA_ENFERMERIA', 'RECTIFICACION'));
      CREATE INDEX IF NOT EXISTS idx_registros_clinicos_corrige_a ON registros_clinicos (corrige_a);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_registros_clinicos_corrige_a
        ON registros_clinicos (corrige_a) WHERE corrige_a IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_registros_clinicos_internacion ON registros_clinicos (internacion_id);
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_registros_clinicos_corrige_a') THEN
          ALTER TABLE registros_clinicos ADD CONSTRAINT fk_registros_clinicos_corrige_a
            FOREIGN KEY (corrige_a) REFERENCES registros_clinicos(id) ON DELETE RESTRICT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_registros_clinicos_turno') THEN
          ALTER TABLE registros_clinicos ADD CONSTRAINT fk_registros_clinicos_turno
            FOREIGN KEY (turno_id) REFERENCES turnos(id) ON DELETE RESTRICT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_registros_clinicos_internacion') THEN
          ALTER TABLE registros_clinicos ADD CONSTRAINT fk_registros_clinicos_internacion
            FOREIGN KEY (internacion_id) REFERENCES internaciones(id) ON DELETE RESTRICT;
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS estudios (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        paciente_id uuid NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
        tipo varchar(120) NOT NULL,
        fecha timestamptz NOT NULL DEFAULT now(),
        estado varchar(20) NOT NULL DEFAULT 'INFORMADO',
        informe text NOT NULL,
        solicitante_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
        storage_key varchar(100) NOT NULL,
        nombre_adjunto varchar(255) NOT NULL,
        media_type varchar(100) NOT NULL,
        tamano_bytes bigint NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_estudios_estado CHECK (estado IN ('SOLICITADO', 'REALIZADO', 'INFORMADO')),
        CONSTRAINT ck_estudios_tamano CHECK (tamano_bytes > 0)
      );
      CREATE INDEX IF NOT EXISTS idx_estudios_paciente_fecha ON estudios (paciente_id, fecha DESC);

      ALTER TABLE indicaciones_medicas
        ADD COLUMN IF NOT EXISTS tipo varchar(20) NOT NULL DEFAULT 'MEDICACION',
        ADD COLUMN IF NOT EXISTS estado varchar(20) NOT NULL DEFAULT 'ACTIVA',
        ADD COLUMN IF NOT EXISTS suspendida_por_id uuid,
        ADD COLUMN IF NOT EXISTS motivo_suspension varchar(500),
        ADD COLUMN IF NOT EXISTS internacion_id uuid;
      ALTER TABLE indicaciones_medicas ALTER COLUMN insumo_id DROP NOT NULL;
      ALTER TABLE indicaciones_medicas
        DROP CONSTRAINT IF EXISTS ck_indicaciones_medicas_tipo_insumo,
        DROP CONSTRAINT IF EXISTS ck_indicaciones_medicas_estado;
      ALTER TABLE indicaciones_medicas
        ADD CONSTRAINT ck_indicaciones_medicas_tipo_insumo
          CHECK ((tipo = 'MEDICACION' AND insumo_id IS NOT NULL) OR (tipo <> 'MEDICACION' AND insumo_id IS NULL)),
        ADD CONSTRAINT ck_indicaciones_medicas_estado CHECK (estado IN ('ACTIVA', 'SUSPENDIDA', 'FINALIZADA'));
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_indicaciones_suspendida_por') THEN
          ALTER TABLE indicaciones_medicas ADD CONSTRAINT fk_indicaciones_suspendida_por
            FOREIGN KEY (suspendida_por_id) REFERENCES usuarios(id) ON DELETE RESTRICT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_indicaciones_internacion') THEN
          ALTER TABLE indicaciones_medicas ADD CONSTRAINT fk_indicaciones_internacion
            FOREIGN KEY (internacion_id) REFERENCES internaciones(id) ON DELETE RESTRICT;
        END IF;
      END $$;
      CREATE INDEX IF NOT EXISTS idx_indicaciones_medicas_internacion ON indicaciones_medicas (internacion_id);

      ALTER TABLE administraciones_medicacion
        ADD COLUMN IF NOT EXISTS dosis_programada_para timestamptz,
        ADD COLUMN IF NOT EXISTS resultado varchar(20) NOT NULL DEFAULT 'ADMINISTRADA',
        ADD COLUMN IF NOT EXISTS motivo_omision varchar(500);
      ALTER TABLE administraciones_medicacion
        DROP CONSTRAINT IF EXISTS ck_administraciones_medicacion_resultado;
      ALTER TABLE administraciones_medicacion
        ADD CONSTRAINT ck_administraciones_medicacion_resultado CHECK (resultado IN ('ADMINISTRADA', 'OMITIDA'));
      CREATE UNIQUE INDEX IF NOT EXISTS uq_administraciones_dosis_programada
        ON administraciones_medicacion (indicacion_id, dosis_programada_para)
        WHERE dosis_programada_para IS NOT NULL;

      ALTER TABLE signos_vitales ADD COLUMN IF NOT EXISTS internacion_id uuid;
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_signos_vitales_internacion') THEN
          ALTER TABLE signos_vitales ADD CONSTRAINT fk_signos_vitales_internacion
            FOREIGN KEY (internacion_id) REFERENCES internaciones(id) ON DELETE RESTRICT;
        END IF;
      END $$;
      CREATE INDEX IF NOT EXISTS idx_signos_vitales_internacion_fecha ON signos_vitales (internacion_id, fecha_hora DESC);

      CREATE TABLE IF NOT EXISTS sectores (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre varchar(100) NOT NULL,
        activo boolean NOT NULL DEFAULT true,
        CONSTRAINT uq_sectores_nombre UNIQUE (nombre)
      );
      CREATE TABLE IF NOT EXISTS habitaciones (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        sector_id uuid NOT NULL REFERENCES sectores(id) ON DELETE RESTRICT,
        numero varchar(50) NOT NULL,
        capacidad integer NOT NULL,
        activo boolean NOT NULL DEFAULT true,
        CONSTRAINT ck_habitaciones_capacidad CHECK (capacidad > 0),
        CONSTRAINT uq_habitaciones_sector_numero UNIQUE (sector_id, numero)
      );
      ALTER TABLE camas
        ADD COLUMN IF NOT EXISTS habitacion_id uuid,
        ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS motivo_bloqueo varchar(500);
      INSERT INTO sectores (nombre)
      SELECT DISTINCT COALESCE(NULLIF(BTRIM(sector), ''), 'Sin sector')
      FROM camas
      ON CONFLICT (nombre) DO NOTHING;
      INSERT INTO habitaciones (sector_id, numero, capacidad)
      SELECT s.id, 'General', COUNT(*)::integer
      FROM camas c
      JOIN sectores s ON s.nombre = COALESCE(NULLIF(BTRIM(c.sector), ''), 'Sin sector')
      GROUP BY s.id
      ON CONFLICT (sector_id, numero) DO UPDATE SET capacidad = GREATEST(habitaciones.capacidad, EXCLUDED.capacidad);
      UPDATE camas c
      SET habitacion_id = h.id
      FROM sectores s
      JOIN habitaciones h ON h.sector_id = s.id AND h.numero = 'General'
      WHERE s.nombre = COALESCE(NULLIF(BTRIM(c.sector), ''), 'Sin sector')
        AND c.habitacion_id IS NULL;
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_camas_habitacion') THEN
          ALTER TABLE camas ADD CONSTRAINT fk_camas_habitacion
            FOREIGN KEY (habitacion_id) REFERENCES habitaciones(id) ON DELETE RESTRICT;
        END IF;
      END $$;
      CREATE INDEX IF NOT EXISTS idx_camas_habitacion ON camas (habitacion_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE camas
        DROP CONSTRAINT IF EXISTS fk_camas_habitacion,
        DROP COLUMN IF EXISTS habitacion_id,
        DROP COLUMN IF EXISTS activo,
        DROP COLUMN IF EXISTS motivo_bloqueo;
      DROP TABLE IF EXISTS habitaciones;
      DROP TABLE IF EXISTS sectores;

      DROP INDEX IF EXISTS idx_signos_vitales_internacion_fecha;
      ALTER TABLE signos_vitales DROP CONSTRAINT IF EXISTS fk_signos_vitales_internacion;
      ALTER TABLE signos_vitales DROP COLUMN IF EXISTS internacion_id;

      DROP INDEX IF EXISTS uq_administraciones_dosis_programada;
      ALTER TABLE administraciones_medicacion
        DROP CONSTRAINT IF EXISTS ck_administraciones_medicacion_resultado,
        DROP COLUMN IF EXISTS dosis_programada_para,
        DROP COLUMN IF EXISTS resultado,
        DROP COLUMN IF EXISTS motivo_omision;

      DROP INDEX IF EXISTS idx_indicaciones_medicas_internacion;
      ALTER TABLE indicaciones_medicas
        DROP CONSTRAINT IF EXISTS ck_indicaciones_medicas_tipo_insumo,
        DROP CONSTRAINT IF EXISTS ck_indicaciones_medicas_estado,
        DROP CONSTRAINT IF EXISTS fk_indicaciones_suspendida_por,
        DROP CONSTRAINT IF EXISTS fk_indicaciones_internacion,
        DROP COLUMN IF EXISTS tipo,
        DROP COLUMN IF EXISTS estado,
        DROP COLUMN IF EXISTS suspendida_por_id,
        DROP COLUMN IF EXISTS motivo_suspension,
        DROP COLUMN IF EXISTS internacion_id;

      DROP INDEX IF EXISTS idx_estudios_paciente_fecha;
      DROP TABLE IF EXISTS estudios;

      DROP INDEX IF EXISTS idx_registros_clinicos_corrige_a;
      DROP INDEX IF EXISTS uq_registros_clinicos_corrige_a;
      DROP INDEX IF EXISTS idx_registros_clinicos_internacion;
      ALTER TABLE registros_clinicos
        DROP CONSTRAINT IF EXISTS fk_registros_clinicos_corrige_a,
        DROP CONSTRAINT IF EXISTS fk_registros_clinicos_turno,
        DROP CONSTRAINT IF EXISTS fk_registros_clinicos_internacion,
        DROP COLUMN IF EXISTS corrige_a,
        DROP COLUMN IF EXISTS turno_id,
        DROP COLUMN IF EXISTS internacion_id,
        DROP CONSTRAINT IF EXISTS ck_registros_clinicos_categoria,
        ADD CONSTRAINT ck_registros_clinicos_categoria
          CHECK (categoria IN ('ALERGIA', 'ANTECEDENTE_FAMILIAR', 'EVOLUCION', 'ESTUDIO', 'NOTA_ENFERMERIA'));
    `);
  }
}
