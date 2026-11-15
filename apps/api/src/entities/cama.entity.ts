import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  VersionColumn,
  JoinColumn,
} from 'typeorm';

import { Paciente } from './paciente.entity.js';
import { EstadoCama } from '../modules/resources/domain/estado-cama.enum.js';
import { Habitacion } from './habitacion.entity.js';

@Entity('camas')
export class Cama {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  numero: string;

  @Column({ nullable: true })
  sector: string;

  @ManyToOne(() => Habitacion, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'habitacion_id' })
  habitacion: Habitacion | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @Column({ name: 'motivo_bloqueo', type: 'varchar', length: 500, nullable: true })
  motivoBloqueo: string | null;

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