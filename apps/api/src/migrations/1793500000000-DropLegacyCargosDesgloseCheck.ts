import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hay bases (p. ej. la de Supabase del equipo) que ejecutaron versiones anteriores de las migraciones de
 * facturación (AddPatientCoverage / AddBillingCoverageBreakdown) y conservan en `cargos` las columnas
 * `importe_paciente` e `importe_cobertura` (NOT NULL, default 0) con el CHECK
 * `ck_cargos_desglose_importes` (importe_paciente + importe_cobertura = importe_pesos).
 * La entidad actual solo escribe `importe_paciente_pesos` / `importe_tercero_pesos`, así que cada
 * INSERT de un cargo viola ese CHECK (el turno pasa a ATENDIDO pero el cargo no se crea).
 *
 * Se elimina únicamente el CHECK. Las columnas legadas NO se borran para no perder los datos de los
 * cargos existentes. Es idempotente: en una base sin ese CHECK no hace nada.
 */
export class DropLegacyCargosDesgloseCheck1793500000000
  implements MigrationInterface
{
  name = 'DropLegacyCargosDesgloseCheck1793500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE cargos DROP CONSTRAINT IF EXISTS ck_cargos_desglose_importes`,
    );
  }

  public async down(): Promise<void> {
    // No se restaura: el CHECK es incompatible con el código actual (haría fallar cada alta de cargo)
    // y las columnas que usa pueden no existir en una base creada desde cero.
  }
}
