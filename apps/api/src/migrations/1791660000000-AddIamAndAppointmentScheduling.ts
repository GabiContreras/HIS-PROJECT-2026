import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIamAndAppointmentScheduling1791660000000 implements MigrationInterface {
  name = 'AddIamAndAppointmentScheduling1791660000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "usuarios"
        ADD COLUMN "estado" character varying NOT NULL DEFAULT 'PENDIENTE_VERIFICACION',
        ADD COLUMN "emailVerificado" boolean NOT NULL DEFAULT false,
        ADD COLUMN "esSuperadmin" boolean NOT NULL DEFAULT false,
        ADD COLUMN "intentosFallidos" integer NOT NULL DEFAULT 0,
        ADD COLUMN "bloqueadoHasta" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    `);
    await queryRunner.query(`
      UPDATE "usuarios"
      SET "estado" = 'ACTIVO', "emailVerificado" = true
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_usuarios_single_superadmin"
      ON "usuarios" ("esSuperadmin")
      WHERE "esSuperadmin" = true
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM "usuarios"
          GROUP BY LOWER("email")
          HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION 'Duplicate user emails differ only by case; resolve them before applying IAM migration';
        END IF;
      END
      $$
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_usuarios_email_lower"
      ON "usuarios" (LOWER("email"))
    `);
    await queryRunner.query(`
      CREATE TABLE "refresh_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "usuarioId" uuid NOT NULL,
        "familiaId" uuid NOT NULL,
        "tokenHash" character varying NOT NULL,
        "expiraEn" TIMESTAMP WITH TIME ZONE NOT NULL,
        "revocadoEn" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_refresh_sessions_tokenHash" UNIQUE ("tokenHash"),
        CONSTRAINT "PK_refresh_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_refresh_sessions_usuario"
          FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_refresh_sessions_usuario_familia"
      ON "refresh_sessions" ("usuarioId", "familiaId")
    `);
    await queryRunner.query(`
      ALTER TABLE "turnos"
      ADD COLUMN "duracionMinutos" integer NOT NULL DEFAULT 30,
      ADD COLUMN "urgente" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "turnos"
        ADD CONSTRAINT "CK_turnos_duracion"
          CHECK ("duracionMinutos" IN (15, 30)),
        ADD CONSTRAINT "CK_turnos_urgente_duracion"
          CHECK (NOT "urgente" OR "duracionMinutos" = 15)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_turnos_medico_fecha"
      ON "turnos" ("medicoId", "fechaHora")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_turnos_medico_fecha"`);
    await queryRunner.query(`
      ALTER TABLE "turnos"
      DROP CONSTRAINT "CK_turnos_urgente_duracion",
      DROP CONSTRAINT "CK_turnos_duracion",
      DROP COLUMN "urgente", DROP COLUMN "duracionMinutos"
    `);
    await queryRunner.query(
      `DROP INDEX "IDX_refresh_sessions_usuario_familia"`,
    );
    await queryRunner.query(`DROP TABLE "refresh_sessions"`);
    await queryRunner.query(`DROP INDEX "IDX_usuarios_email_lower"`);
    await queryRunner.query(`DROP INDEX "IDX_usuarios_single_superadmin"`);
    await queryRunner.query(`
      ALTER TABLE "usuarios"
        DROP COLUMN "updatedAt",
        DROP COLUMN "bloqueadoHasta",
        DROP COLUMN "intentosFallidos",
        DROP COLUMN "esSuperadmin",
        DROP COLUMN "emailVerificado",
        DROP COLUMN "estado"
    `);
  }
}
