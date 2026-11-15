import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { Financiador } from './financiador.entity.js';
import { Prestacion } from './prestacion.entity.js';

@Entity('tarifas')
@Unique('uq_tarifas_financiador_prestacion', ['financiadorId', 'prestacionId'])
export class Tarifa {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'financiador_id', type: 'uuid' })
  financiadorId: string;

  @Column({ name: 'prestacion_id', type: 'uuid' })
  prestacionId: string;

  @Column({ name: 'valor_pesos', type: 'integer' })
  valorPesos: number;

  @Column({ name: 'copago_pesos', type: 'integer', nullable: true })
  copagoPesos: number | null;

  @Column({ name: 'activo', type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Financiador, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'financiador_id' })
  financiador: Financiador;

  @ManyToOne(() => Prestacion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'prestacion_id' })
  prestacion: Prestacion;
}
