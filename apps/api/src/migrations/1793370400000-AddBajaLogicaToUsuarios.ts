import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baja lógica de cuentas: estado BAJA + fecha de baja. Solo el superadmin la aplica.
 * usuarios.estado es texto; si algún entorno lo restringe con un CHECK, se amplía para admitir BAJA.
 */
export class AddBajaLogicaToUsuarios1793370400000 implements MigrationInterface {
  name = 'AddBajaLogicaToUsuarios1793370400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const checks = (await queryRunner.query(`
      SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = to_regclass('usuarios') AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%DESHABILITADO%'
    `)) as Array<{ conname: string; definition: string }>;
    for (const check of checks) {
      if (check.definition.includes("'BAJA'")) continue;
      const widened = check.definition.replace(
        /'DESHABILITADO'::([a-z ]+)/,
        (listed, castType: string) => `${listed}, 'BAJA'::${castType.trim()}`,
      );
      if (widened === check.definition) {
        throw new Error(
          `No se pudo ampliar el CHECK ${check.conname}: ${check.definition}`,
        );
      }
      await queryRunner.query(`ALTER TABLE usuarios DROP CONSTRAINT "${check.conname}"`);
      await queryRunner.query(`ALTER TABLE usuarios ADD CONSTRAINT "${check.conname}" ${widened}`);
    }

    await queryRunner.query(`
      ALTER TABLE usuarios
        ADD COLUMN dado_de_baja_en timestamptz,
        ADD CONSTRAINT ck_usuarios_baja_coherente
          CHECK ((estado = 'BAJA') = (dado_de_baja_en IS NOT NULL))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Las cuentas dadas de baja vuelven a DESHABILITADO: nadie queda con un estado desconocido.
    await queryRunner.query(`
      ALTER TABLE usuarios DROP CONSTRAINT ck_usuarios_baja_coherente
    `);
    await queryRunner.query(`UPDATE usuarios SET estado = 'DESHABILITADO' WHERE estado = 'BAJA'`);
    await queryRunner.query(`ALTER TABLE usuarios DROP COLUMN dado_de_baja_en`);
  }
}
