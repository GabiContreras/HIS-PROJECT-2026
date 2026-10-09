import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, VersionColumn,JoinColumn } from 'typeorm';
import { Paciente } from './paciente.entity.js';

export enum EstadoCama {
  DISPONIBLE = 'DISPONIBLE',
  OCUPADA = 'OCUPADA',
  RESERVADA = 'RESERVADA',
  MANTENIMIENTO = 'MANTENIMIENTO',
}

@Entity('camas')
export class Cama {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  numero: string;

  @Column({ nullable: true })
  sector: string;

  @Column({ type: 'enum', enum: EstadoCama, default: EstadoCama.DISPONIBLE })
  estado: EstadoCama;

  @ManyToOne(() => Paciente, { nullable: true, onDelete: 'SET NULL' })
@JoinColumn({ name: 'paciente_actual_id' })
pacienteActual: Paciente;

  @VersionColumn()
  version: number;
}
