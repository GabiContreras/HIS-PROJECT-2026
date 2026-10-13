import { MigrationInterface, QueryRunner } from 'typeorm';

export class BaselineSchema1791750000000 implements MigrationInterface {
  name = 'BaselineSchema1791750000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- ============================================================================
-- SECCIÓN 1: TIPOS ENUM
-- ============================================================================

CREATE TYPE rol_usuario AS ENUM ('MEDICO', 'ENFERMERO', 'ADMINISTRATIVO');
CREATE TYPE estado_turno AS ENUM ('DISPONIBLE', 'RESERVADO', 'CONFIRMADO', 'ATENDIDO', 'CANCELADO');
CREATE TYPE estado_cama AS ENUM ('DISPONIBLE', 'OCUPADA', 'RESERVADA', 'MANTENIMIENTO');

-- ============================================================================
-- SECCIÓN 2: TABLAS
-- PK: gen_random_uuid() — nativa desde PG13, disponible en Supabase sin
-- instalar ninguna extensión adicional.
-- ============================================================================

-- --- usuarios ---------------------------------------------------------------
CREATE TABLE usuarios (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          VARCHAR(100)    NOT NULL,
    apellido        VARCHAR(100)    NOT NULL,
    email           VARCHAR(150)    NOT NULL,
    password_hash   TEXT            NOT NULL,
    rol             rol_usuario     NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT uq_usuarios_email UNIQUE (email),
    CONSTRAINT ck_usuarios_email_formato CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);
COMMENT ON TABLE usuarios IS 'Médicos, enfermeros y administrativos. Médico/Enfermero son roles, no entidades separadas.';

-- --- pacientes ----------------------------------------------------------------
CREATE TABLE pacientes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre              VARCHAR(100)    NOT NULL,
    apellido            VARCHAR(100)    NOT NULL,
    documento           VARCHAR(20)     NOT NULL,
    fecha_nacimiento    DATE            NOT NULL,
    telefono            VARCHAR(30),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT uq_pacientes_documento UNIQUE (documento),
    CONSTRAINT ck_pacientes_fecha_nacimiento CHECK (fecha_nacimiento <= CURRENT_DATE)
);

-- --- insumos ------------------------------------------------------------------
CREATE TABLE insumos (

    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre                  VARCHAR(150)    NOT NULL,
    unidad_medida           VARCHAR(20)     NOT NULL,
    cantidad_disponible     INTEGER         NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT uq_insumos_nombre UNIQUE (nombre),
    CONSTRAINT ck_insumos_cantidad_no_negativa CHECK (cantidad_disponible >= 0)
);

-- --- camas ----------------------------------------------------------------
CREATE TABLE camas (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero              VARCHAR(10)     NOT NULL,
    sector              VARCHAR(50),
    estado              estado_cama     NOT NULL DEFAULT 'DISPONIBLE',
    paciente_actual_id  UUID,
    version             INTEGER         NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT uq_camas_numero UNIQUE (numero),
    CONSTRAINT uq_camas_paciente_actual UNIQUE (paciente_actual_id),
    CONSTRAINT fk_camas_paciente_actual FOREIGN KEY (paciente_actual_id)
        REFERENCES pacientes (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT ck_camas_ocupacion_coherente CHECK (
        (estado = 'OCUPADA' AND paciente_actual_id IS NOT NULL) OR
        (estado <> 'OCUPADA' AND paciente_actual_id IS NULL) OR
        (estado = 'OCUPADA' AND paciente_actual_id IS NULL)
    )
);
COMMENT ON COLUMN camas.version IS 'Optimistic locking (VersionColumn en TypeORM) — evita asignación doble concurrente.';

-- --- turnos -----------------------------------------------------------------
CREATE TABLE turnos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id     UUID            NOT NULL,
    medico_id       UUID            NOT NULL,
    fecha_hora      TIMESTAMPTZ     NOT NULL,
    estado          estado_turno    NOT NULL DEFAULT 'DISPONIBLE',
    version         INTEGER         NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT fk_turnos_paciente FOREIGN KEY (paciente_id)
        REFERENCES pacientes (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_turnos_medico FOREIGN KEY (medico_id)
        REFERENCES usuarios (id) ON DELETE RESTRICT ON UPDATE CASCADE
);
COMMENT ON COLUMN turnos.version IS 'Optimistic locking — evita doble reserva concurrente del mismo turno.';

-- --- signos_vitales -----------------------------------------------------------
CREATE TABLE signos_vitales (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id         UUID            NOT NULL,
    registrado_por_id   UUID            NOT NULL,
    tipo                VARCHAR(30)     NOT NULL,
    valor               NUMERIC(6,2)    NOT NULL,
    fecha_hora          TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT fk_signos_paciente FOREIGN KEY (paciente_id)
        REFERENCES pacientes (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_signos_registrado_por FOREIGN KEY (registrado_por_id)
        REFERENCES usuarios (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_signos_tipo CHECK (tipo IN ('PRESION_ARTERIAL', 'TEMPERATURA', 'FRECUENCIA_CARDIACA', 'FRECUENCIA_RESPIRATORIA', 'SATURACION_O2'))
);

-- --- indicaciones_medicas -------------------------------------------------
CREATE TABLE indicaciones_medicas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id     UUID            NOT NULL,
    medico_id       UUID            NOT NULL,
    insumo_id       UUID            NOT NULL,
    dosis           VARCHAR(50)     NOT NULL,
    frecuencia      VARCHAR(50)     NOT NULL,
    fecha_inicio    TIMESTAMPTZ     NOT NULL DEFAULT now(),
    fecha_fin       TIMESTAMPTZ,
    CONSTRAINT fk_indicaciones_paciente FOREIGN KEY (paciente_id)
        REFERENCES pacientes (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_indicaciones_medico FOREIGN KEY (medico_id)
        REFERENCES usuarios (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_indicaciones_insumo FOREIGN KEY (insumo_id)
        REFERENCES insumos (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_indicaciones_fechas CHECK (fecha_fin IS NULL OR fecha_fin > fecha_inicio)
);

-- --- administraciones_medicacion -------------------------------------------
CREATE TABLE administraciones_medicacion (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    indicacion_id               UUID            NOT NULL,
    enfermero_id                UUID            NOT NULL,
    fecha_hora_administracion   TIMESTAMPTZ     NOT NULL DEFAULT now(),
    observaciones               TEXT,
    CONSTRAINT fk_administraciones_indicacion FOREIGN KEY (indicacion_id)
        REFERENCES indicaciones_medicas (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_administraciones_enfermero FOREIGN KEY (enfermero_id)
        REFERENCES usuarios (id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ============================================================================
-- SECCIÓN 3: ÍNDICES
-- ============================================================================

CREATE INDEX idx_turnos_paciente_id ON turnos (paciente_id);
CREATE INDEX idx_turnos_medico_id ON turnos (medico_id);
CREATE INDEX idx_turnos_fecha_hora ON turnos (fecha_hora);
CREATE INDEX idx_turnos_estado ON turnos (estado) WHERE estado = 'DISPONIBLE';
CREATE UNIQUE INDEX uq_turnos_medico_fecha_activo ON turnos (medico_id, fecha_hora) WHERE estado <> 'CANCELADO';

CREATE INDEX idx_camas_paciente_actual_id ON camas (paciente_actual_id);
CREATE INDEX idx_camas_estado ON camas (estado);

CREATE INDEX idx_signos_paciente_id ON signos_vitales (paciente_id);
CREATE INDEX idx_signos_registrado_por_id ON signos_vitales (registrado_por_id);

CREATE INDEX idx_signos_paciente_fecha ON signos_vitales (paciente_id, fecha_hora DESC);

CREATE INDEX idx_indicaciones_paciente_id ON indicaciones_medicas (paciente_id);
CREATE INDEX idx_indicaciones_medico_id ON indicaciones_medicas (medico_id);
CREATE INDEX idx_indicaciones_insumo_id ON indicaciones_medicas (insumo_id);

CREATE INDEX idx_administraciones_indicacion_id ON administraciones_medicacion (indicacion_id);
CREATE INDEX idx_administraciones_enfermero_id ON administraciones_medicacion (enfermero_id);


    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      
    DROP TABLE IF EXISTS administraciones_medicacion CASCADE;
    DROP TABLE IF EXISTS indicaciones_medicas CASCADE;
    DROP TABLE IF EXISTS signos_vitales CASCADE;
    DROP TABLE IF EXISTS turnos CASCADE;
    DROP TABLE IF EXISTS camas CASCADE;
    DROP TABLE IF EXISTS insumos CASCADE;
    DROP TABLE IF EXISTS pacientes CASCADE;
    DROP TABLE IF EXISTS usuarios CASCADE;

    DROP TYPE IF EXISTS estado_cama;
    DROP TYPE IF EXISTS estado_turno;
    DROP TYPE IF EXISTS rol_usuario;
    `);
  }
}