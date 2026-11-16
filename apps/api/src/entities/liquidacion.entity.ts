import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Financiador } from './financiador.entity.js';

@Entity('liquidaciones')
export class Liquidacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'financiador_id', type: 'uuid' })
  financiadorId: string;

  @ManyToOne(() => Financiador, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'financiador_id' })
  financiador: Financiador;

  @Column({ name: 'periodo_desde', type: 'date' })
  periodoDesde: string;

  @Column({ name: 'periodo_hasta', type: 'date' })
  periodoHasta: string;

  @Column({ name: 'cantidad_cargos', type: 'integer' })
  cantidadCargos: number;

  @Column({ name: 'total_pesos', type: 'integer' })
  totalPesos: number;

  @Column({ name: 'usuario_id', type: 'uuid', nullable: true })
  usuarioId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
