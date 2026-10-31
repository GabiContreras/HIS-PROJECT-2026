import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 1) Horario laboral por médico (la disponibilidad se calcula dentro de este rango).
 * 2) Nuevo estado EN_SALA_DE_ESPERA entre CONFIRMADO y ATENDIDO.
 *
 * turnos.estado puede ser un ENUM de Postgres (con cualquier nombre de tipo) o un
 * texto con CHECK, según las migraciones previas de cada entorno: se detecta del catálogo.
 */
export class DoctorScheduleAndWaitingRoom1793370000000
  implements MigrationInterface
{
  name = 'DoctorScheduleAndWaitingRoom1793370000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.allowWaitingRoomState(queryRunner);

    // Por defecto, el horario general de la clínica: nadie pierde turnos al migrar.
    await queryRunner.query(`
      ALTER TABLE usuarios
        ADD COLUMN "horaInicio" TIME NOT NULL DEFAULT '08:00',
        ADD COLUMN "horaFin" TIME NOT NULL DEFAULT '20:00',
        ADD CONSTRAINT "CK_usuarios_horario_clinica"
          CHECK ("horaInicio" >= TIME '08:00' AND "horaFin" <= TIME '20:00'),
        ADD CONSTRAINT "CK_usuarios_horario_orden"
          CHECK ("horaInicio" < "horaFin"),
        ADD CONSTRAINT "CK_usuarios_horario_media_hora"
          CHECK (
            EXTRACT(MINUTE FROM "horaInicio") IN (0, 30)
            AND EXTRACT(MINUTE FROM "horaFin") IN (0, 30)
          )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE usuarios
        DROP CONSTRAINT "CK_usuarios_horario_media_hora",
        DROP CONSTRAINT "CK_usuarios_horario_orden",
        DROP CONSTRAINT "CK_usuarios_horario_clinica",
        DROP COLUMN "horaFin",
        DROP COLUMN "horaInicio"
    `);
    // Postgres no permite quitar un valor de un enum: EN_SALA_DE_ESPERA queda definido (sin uso).
  }

  private async allowWaitingRoomState(queryRunner: QueryRunner): Promise<void> {
    const [column] = (await queryRunner.query(`
      SELECT a.atttypid::regtype::text AS type_name, t.typtype AS type_kind
      FROM pg_attribute a
      JOIN pg_type t ON t.oid = a.atttypid
      WHERE a.attrelid = to_regclass('turnos') AND a.attname = 'estado' AND NOT a.attisdropped
    `)) as Array<{ type_name: string; type_kind: string }>;
    if (!column) {
      throw new Error('No se encontró la columna turnos.estado.');
    }

    if (column.type_kind === 'e') {
      // typtype 'e' = enum; type_name viene ya calificado y entrecomillado por regtype.
      await queryRunner.query(
        `ALTER TYPE ${column.type_name} ADD VALUE IF NOT EXISTS 'EN_SALA_DE_ESPERA' AFTER 'CONFIRMADO'`,
      );
      return;
    }

    // Columna de texto: ampliar el/los CHECK que listan los estados.
    const checks = (await queryRunner.query(`
      SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = to_regclass('turnos') AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%CONFIRMADO%'
    `)) as Array<{ conname: string; definition: string }>;
    for (const check of checks) {
      if (check.definition.includes('EN_SALA_DE_ESPERA')) continue;
      const widened = check.definition.replace(
        /'CONFIRMADO'::([a-z ]+)/,
        (listed, castType: string) =>
          `${listed}, 'EN_SALA_DE_ESPERA'::${castType.trim()}`,
      );
      if (widened === check.definition) {
        throw new Error(
          `No se pudo ampliar el CHECK ${check.conname}: ${check.definition}`,
        );
      }
      await queryRunner.query(
        `ALTER TABLE turnos DROP CONSTRAINT "${check.conname}"`,
      );
      await queryRunner.query(
        `ALTER TABLE turnos ADD CONSTRAINT "${check.conname}" ${widened}`,
      );
    }
  }
}
