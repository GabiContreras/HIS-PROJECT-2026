import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import {
  OrigenMovimientoInventario,
  TipoMovimientoInventario,
} from '../modules/resources/domain/inventory-movement.js';

@Entity('movimientos_inventario')
export class MovimientoInventario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'insumo_id', type: 'uuid' })
  insumoId: string;

  @Column({ type: 'varchar', length: 20 })
  tipo: TipoMovimientoInventario;

  @Column({ type: 'integer' })
  cantidad: number;

  @Column({ name: 'stock_resultante', type: 'integer' })
  stockResultante: number;

  @Column({ name: 'usuario_id', type: 'uuid', nullable: true })
  usuarioId: string | null;

  @Column({ type: 'varchar', length: 40 })
  origen: OrigenMovimientoInventario;

  @Column({ name: 'referencia_id', type: 'uuid', nullable: true })
  referenciaId: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  motivo: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
