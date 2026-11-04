import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlinearEstadosCama1793200000000 implements MigrationInterface {
  name = 'AlinearEstadosCama1793200000000';

  public async up(q: QueryRunner): Promise<void> {
    // PostgreSQL no permite quitar valores de un enum: pasamos por varchar,
    // remapeamos los datos y recreamos el tipo estado_cama.
    await q.query(`ALTER TABLE camas ALTER COLUMN estado DROP DEFAULT`);
    await q.query(`ALTER TABLE camas ALTER COLUMN estado TYPE varchar USING estado::text`);
    await q.query(`
      UPDATE camas SET estado = CASE estado
        WHEN 'DISPONIBLE'    THEN 'LIBRE'
        WHEN 'RESERVADA'     THEN 'BLOQUEADA'
        WHEN 'MANTENIMIENTO' THEN 'BLOQUEADA'
        ELSE estado END
    `);
    await q.query(`DROP TYPE IF EXISTS estado_cama`);
    await q.query(`CREATE TYPE estado_cama AS ENUM ('LIBRE', 'OCUPADA', 'EN_LIMPIEZA', 'BLOQUEADA')`);
    await q.query(`ALTER TABLE camas ALTER COLUMN estado TYPE estado_cama USING estado::estado_cama`);
    await q.query(`ALTER TABLE camas ALTER COLUMN estado SET DEFAULT 'LIBRE'`);

    // Un paciente no puede tener dos internaciones activas
    // (la de cama ya existe: idx_cama_activa_unica).
    await q.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_paciente_internacion_activa_unica
        ON internaciones (paciente_id) WHERE fecha_egreso IS NULL
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS idx_paciente_internacion_activa_unica`);
    await q.query(`ALTER TABLE camas ALTER COLUMN estado DROP DEFAULT`);
    await q.query(`ALTER TABLE camas ALTER COLUMN estado TYPE varchar USING estado::text`);
    await q.query(`
      UPDATE camas SET estado = CASE estado
        WHEN 'LIBRE'       THEN 'DISPONIBLE'
        WHEN 'EN_LIMPIEZA' THEN 'MANTENIMIENTO'
        WHEN 'BLOQUEADA'   THEN 'MANTENIMIENTO'
        ELSE estado END
    `);
    await q.query(`DROP TYPE IF EXISTS estado_cama`);
    await q.query(`CREATE TYPE estado_cama AS ENUM ('DISPONIBLE', 'OCUPADA', 'RESERVADA', 'MANTENIMIENTO')`);
    await q.query(`ALTER TABLE camas ALTER COLUMN estado TYPE estado_cama USING estado::estado_cama`);
    await q.query(`ALTER TABLE camas ALTER COLUMN estado SET DEFAULT 'DISPONIBLE'`);
  }
}