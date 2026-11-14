import { MigrationInterface, QueryRunner } from 'typeorm';

/** Permite registrar la presión diastólica como tipo propio de signo vital (la tabla guarda un valor por tipo). */
export class AddPresionDiastolicaToSignosVitales1793400000000 implements MigrationInterface {
  name = 'AddPresionDiastolicaToSignosVitales1793400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE signos_vitales DROP CONSTRAINT IF EXISTS ck_signos_tipo`);
    await queryRunner.query(`
      ALTER TABLE signos_vitales ADD CONSTRAINT ck_signos_tipo
        CHECK (tipo IN ('PRESION_ARTERIAL', 'PRESION_DIASTOLICA', 'TEMPERATURA', 'FRECUENCIA_CARDIACA', 'FRECUENCIA_RESPIRATORIA', 'SATURACION_O2'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM signos_vitales WHERE tipo = 'PRESION_DIASTOLICA'`);
    await queryRunner.query(`ALTER TABLE signos_vitales DROP CONSTRAINT IF EXISTS ck_signos_tipo`);
    await queryRunner.query(`
      ALTER TABLE signos_vitales ADD CONSTRAINT ck_signos_tipo
        CHECK (tipo IN ('PRESION_ARTERIAL', 'TEMPERATURA', 'FRECUENCIA_CARDIACA', 'FRECUENCIA_RESPIRATORIA', 'SATURACION_O2'))
    `);
  }
}
