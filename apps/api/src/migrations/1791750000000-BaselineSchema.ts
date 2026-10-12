import { MigrationInterface, QueryRunner } from 'typeorm';

export class BaselineSchema1791750000000 implements MigrationInterface {
  name = 'BaselineSchema1791750000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE usuarios_rol_enum AS ENUM (
        'MEDICO',
        'ENFERMERO',
        'ADMINISTRATIVO'
      );

      CREATE TYPE turnos_estado_enum AS ENUM (
        'DISPONIBLE',
        'RESERVADO',
        'CONFIRMADO',
        'ATENDIDO',
        'CANCELADO'
      );

      CREATE TYPE camas_estado_enum AS ENUM (
        'DISPONIBLE',
        'OCUPADA',
        'RESERVADA',
        'MANTENIMIENTO'
      );

      CREATE TABLE usuarios (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        nombre VARCHAR NOT NULL,
        apellido VARCHAR NOT NULL,
        email VARCHAR NOT NULL UNIQUE,
        password_hash VARCHAR NOT NULL,
        rol usuarios_rol_enum NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE pacientes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        nombre VARCHAR NOT NULL,
        apellido VARCHAR NOT NULL,
        documento VARCHAR NOT NULL UNIQUE,
        fecha_nacimiento DATE NOT NULL,
        telefono VARCHAR
      );

      CREATE TABLE camas (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        numero VARCHAR NOT NULL UNIQUE,
        sector VARCHAR,
        estado camas_estado_enum NOT NULL DEFAULT 'DISPONIBLE',
        version INTEGER NOT NULL,
        paciente_actual_id UUID
      );

      CREATE TABLE turnos (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        fecha_hora TIMESTAMPTZ NOT NULL,
        estado turnos_estado_enum NOT NULL DEFAULT 'DISPONIBLE',
        version INTEGER NOT NULL,
        paciente_id UUID,
        medico_id UUID
      );

      CREATE TABLE insumos (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        nombre VARCHAR NOT NULL UNIQUE,
        unidad_medida VARCHAR NOT NULL,
        cantidad_disponible INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE signos_vitales (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tipo VARCHAR NOT NULL,
        valor DOUBLE PRECISION NOT NULL,
        fecha_hora TIMESTAMPTZ NOT NULL DEFAULT now(),
        paciente_id UUID,
        registrado_por_id UUID
      );

      CREATE TABLE indicaciones_medicas (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        dosis VARCHAR NOT NULL,
        frecuencia VARCHAR NOT NULL,
        fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
        fecha_fin TIMESTAMPTZ,
        paciente_id UUID,
        medico_id UUID,
        insumo_id UUID
      );

      CREATE TABLE administraciones_medicacion (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        fecha_hora_administracion TIMESTAMPTZ NOT NULL DEFAULT now(),
        observaciones VARCHAR,
        indicacion_id UUID,
        enfermero_id UUID
      );

      ALTER TABLE camas
        ADD CONSTRAINT fk_camas_paciente
        FOREIGN KEY (paciente_actual_id)
        REFERENCES pacientes(id)
        ON DELETE SET NULL;

      ALTER TABLE turnos
        ADD CONSTRAINT fk_turnos_paciente
        FOREIGN KEY (paciente_id)
        REFERENCES pacientes(id);

      ALTER TABLE turnos
        ADD CONSTRAINT fk_turnos_medico
        FOREIGN KEY (medico_id)
        REFERENCES usuarios(id);

      ALTER TABLE signos_vitales
        ADD CONSTRAINT fk_signos_paciente
        FOREIGN KEY (paciente_id)
        REFERENCES pacientes(id)
        ON DELETE CASCADE;

      ALTER TABLE signos_vitales
        ADD CONSTRAINT fk_signos_usuario
        FOREIGN KEY (registrado_por_id)
        REFERENCES usuarios(id);

      ALTER TABLE indicaciones_medicas
        ADD CONSTRAINT fk_indicaciones_paciente
        FOREIGN KEY (paciente_id)
        REFERENCES pacientes(id)
        ON DELETE CASCADE;

      ALTER TABLE indicaciones_medicas
        ADD CONSTRAINT fk_indicaciones_medico
        FOREIGN KEY (medico_id)
        REFERENCES usuarios(id);

      ALTER TABLE indicaciones_medicas
        ADD CONSTRAINT fk_indicaciones_insumo
        FOREIGN KEY (insumo_id)
        REFERENCES insumos(id);

      ALTER TABLE administraciones_medicacion
        ADD CONSTRAINT fk_admin_indicacion
        FOREIGN KEY (indicacion_id)
        REFERENCES indicaciones_medicas(id)
        ON DELETE CASCADE;

      ALTER TABLE administraciones_medicacion
        ADD CONSTRAINT fk_admin_enfermero
        FOREIGN KEY (enfermero_id)
        REFERENCES usuarios(id);
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

      DROP TYPE IF EXISTS camas_estado_enum;
      DROP TYPE IF EXISTS turnos_estado_enum;
      DROP TYPE IF EXISTS usuarios_rol_enum;
    `);
  }
}