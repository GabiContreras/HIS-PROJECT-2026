import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Financiador } from './financiador.entity.js';

@Entity('planes')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'financiador_id', type: 'uuid' })
  financiadorId: string;

  @Column({ name: 'nombre', type: 'varchar', length: 100 })
  nombre: string;

  @Column({ name: 'activo', type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Financiador, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'financiador_id' })
  financiador: Financiador;
}
