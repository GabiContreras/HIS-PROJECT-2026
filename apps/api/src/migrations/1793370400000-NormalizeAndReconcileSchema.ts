import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 1) AddIamAndAppointmentScheduling y DoctorScheduleAndWaitingRoom crearon columnas
 *    camelCase, pero la SnakeNamingStrategy de las entidades espera snake_case. Se
 *    renombran acá (solo si la vieja existe y la nueva no). Postgres actualiza solo
 *    los CHECK, índices y la EXCLUDE que referencian estas columnas.
 * 2) Alinea el esquema de una base que ejecutó BaselineSchema / AddIamAndAppointmentScheduling
 *    antes de que esas migraciones se editaran (turnos.paciente_id nullable, sin el índice
 *    único viejo y con la restricción EXCLUDE de superposición de turnos).
 * Todo es idempotente: sirve en una base vacía y en una ya migrada.
 */
const RENAMES: Array<[table: string, from: string, to: string]> = [
  ['usuarios', 'emailVerificado', 'email_verificado'],
  ['usuarios', 'esSuperadmin', 'es_superadmin'],
  ['usuarios', 'intentosFallidos', 'intentos_fallidos'],
  ['usuarios', 'bloqueadoHasta', 'bloqueado_hasta'],
  ['usuarios', 'horaInicio', 'hora_inicio'],
  ['usuarios', 'horaFin', 'hora_fin'],
  ['usuarios', 'updatedAt', 'updated_at'],
  ['turnos', 'duracionMinutos', 'duracion_minutos'],
  ['refresh_sessions', 'usuarioId', 'usuario_id'],
  ['refresh_sessions', 'familiaId', 'familia_id'],
  ['refresh_sessions', 'tokenHash', 'token_hash'],
  ['refresh_sessions', 'expiraEn', 'expira_en'],
  ['refresh_sessions', 'revocadoEn', 'revocado_en'],
  ['refresh_sessions', 'createdAt', 'created_at'],
];

async function hasColumn(
  queryRunner: QueryRunner,
  table: string,
  column: string,
): Promise<boolean> {
  const rows = (await queryRunner.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2`,
    [table, column],
  )) as unknown[];
  return rows.length > 0;
}

async function renameIfNeeded(
  queryRunner: QueryRunner,
  table: string,
  from: string,
  to: string,
): Promise<void> {
  if (
    (await hasColumn(queryRunner, table, from)) &&
    !(await hasColumn(queryRunner, table, to))
  ) {
    await queryRunner.query(
      `ALTER TABLE "${table}" RENAME COLUMN "${from}" TO "${to}"`,
    );
  }
}

export class NormalizeAndReconcileSchema1793370400000
  implements MigrationInterface
{
  name = 'NormalizeAndReconcileSchema1793370400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, from, to] of RENAMES) {
      await renameIfNeeded(queryRunner, table, from, to);
    }

    await queryRunner.query(
      `ALTER TABLE turnos ALTER COLUMN paciente_id DROP NOT NULL`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS uq_turnos_medico_fecha_activo`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'ex_turnos_medico_sin_superposicion'
            AND conrelid = to_regclass('turnos')
        ) THEN
          ALTER TABLE turnos
            ADD CONSTRAINT ex_turnos_medico_sin_superposicion
            EXCLUDE USING GIST (
              medico_id WITH =,
              (tsrange(
                fecha_hora AT TIME ZONE 'UTC',
                (fecha_hora AT TIME ZONE 'UTC') + duracion_minutos * INTERVAL '1 minute',
                '[)'
              )) WITH &&
            )
            WHERE (estado IN ('RESERVADO', 'CONFIRMADO'));
        END IF;
      END
      $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Solo revierte los nombres de columna; los ajustes de esquema (1.2) son aditivos.
    for (const [table, from, to] of [...RENAMES].reverse()) {
      await renameIfNeeded(queryRunner, table, to, from);
    }
  }
}
