import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Renombra columnas camelCase heredadas de la InitSchema original a snake_case.
 *
 * Es idempotente: solo renombra si la tabla existe, la columna vieja existe y la nueva no.
 * - Base creada con la InitSchema original (camelCase): renombra.
 * - Base vacía (BaselineSchema todavía no corrió, corre después por timestamp): no hace nada.
 * - Base ya en snake_case: no hace nada.
 * Las columnas camelCase que agregan migraciones posteriores las renombra
 * 1793370400000-NormalizeAndReconcileSchema.
 */
const RENAMES: Array<[table: string, from: string, to: string]> = [
  ['usuarios', 'passwordHash', 'password_hash'],
  ['usuarios', 'createdAt', 'created_at'],
  ['pacientes', 'fechaNacimiento', 'fecha_nacimiento'],
  ['turnos', 'fechaHora', 'fecha_hora'],
  ['turnos', 'pacienteId', 'paciente_id'],
  ['turnos', 'medicoId', 'medico_id'],
  ['camas', 'pacienteActualId', 'paciente_actual_id'],
  ['insumos', 'unidadMedida', 'unidad_medida'],
  ['insumos', 'cantidadDisponible', 'cantidad_disponible'],
  ['signos_vitales', 'fechaHora', 'fecha_hora'],
  ['signos_vitales', 'pacienteId', 'paciente_id'],
  ['signos_vitales', 'registradoPorId', 'registrado_por_id'],
  ['indicaciones_medicas', 'fechaInicio', 'fecha_inicio'],
  ['indicaciones_medicas', 'fechaFin', 'fecha_fin'],
  ['indicaciones_medicas', 'pacienteId', 'paciente_id'],
  ['indicaciones_medicas', 'medicoId', 'medico_id'],
  ['indicaciones_medicas', 'insumoId', 'insumo_id'],
  ['administraciones_medicacion', 'fechaHoraAdministracion', 'fecha_hora_administracion'],
  ['administraciones_medicacion', 'indicacionId', 'indicacion_id'],
  ['administraciones_medicacion', 'enfermeroId', 'enfermero_id'],
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

export class NormalizeColumnNamesToSnakeCase1791576000000
  implements MigrationInterface
{
  name = 'NormalizeColumnNamesToSnakeCase1791576000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, from, to] of RENAMES) {
      await renameIfNeeded(queryRunner, table, from, to);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table, from, to] of [...RENAMES].reverse()) {
      await renameIfNeeded(queryRunner, table, to, from);
    }
  }
}
