import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecepcionistaRol1795000000000 implements MigrationInterface {
  name = 'AddRecepcionistaRol1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Solo agrega el valor; no se usa en esta migración (Postgres no lo permite
    // dentro de la misma transacción donde se crea).
    await queryRunner.query(
      `ALTER TYPE rol_usuario ADD VALUE IF NOT EXISTS 'RECEPCIONISTA'`,
    );
  }

  public async down(): Promise<void> {
    // Postgres no permite quitar un valor de un enum. Revertir exigiría
    // recrear el tipo; se deja como no-op documentado.
  }
}