import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  VersionColumn,
  JoinColumn,
} from 'typeorm';

import { Paciente } from '../../../../admissions/infrastructure/persistence/entities/paciente.entity.js';
import { EstadoCama } from '../../../domain/estado-cama.enum.js';

@Entity('camas')
export class Cama {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  numero: string;

  @Column({ nullable: true })
  sector: string;

  @Column({
    type: 'enum',
    enum: EstadoCama,
    enumName: 'estado_cama',
    default: EstadoCama.LIBRE,
  })
  estado: EstadoCama;

  @ManyToOne(() => Paciente, { nullable: true, onDelete: 'SET NULL' })

  @JoinColumn({ name: 'paciente_actual_id' })
  pacienteActual: Paciente | null;


  @VersionColumn()
  version: number;
}