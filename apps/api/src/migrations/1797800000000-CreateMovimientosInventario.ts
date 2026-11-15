import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMovimientosInventario1797800000000 implements MigrationInterface {
  name = 'CreateMovimientosInventario1797800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS movimientos_inventario (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        insumo_id uuid NOT NULL,
        tipo varchar(20) NOT NULL,
        cantidad integer NOT NULL,
        stock_resultante integer NOT NULL,
        usuario_id uuid,
        origen varchar(40) NOT NULL,
        referencia_id uuid,
        motivo varchar(200),
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_movimientos_inventario_insumo
          FOREIGN KEY (insumo_id) REFERENCES insumos (id) ON DELETE RESTRICT,
        CONSTRAINT fk_movimientos_inventario_usuario
          FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL,
        CONSTRAINT ck_movimientos_inventario_tipo
          CHECK (tipo IN ('DESCUENTO', 'REPOSICION')),
        CONSTRAINT ck_movimientos_inventario_origen
          CHECK (origen IN ('MANUAL', 'ADMINISTRACION_MEDICACION')),
        CONSTRAINT ck_movimientos_inventario_cantidad
          CHECK (cantidad > 0),
        CONSTRAINT ck_movimientos_inventario_stock_resultante
          CHECK (stock_resultante >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_movimientos_inventario_insumo_fecha
      ON movimientos_inventario (insumo_id, created_at)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_movimientos_inventario_fecha
      ON movimientos_inventario (created_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_movimientos_inventario_fecha`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_movimientos_inventario_insumo_fecha`);
    await queryRunner.query(`DROP TABLE IF EXISTS movimientos_inventario`);
  }
}
