import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, VersionColumn, JoinColumn } from 'typeorm';
import { Paciente } from './paciente.entity.js';
import { Usuario } from './usuario.entity.js';

export enum EstadoTurno {
  DISPONIBLE = 'DISPONIBLE',
  RESERVADO = 'RESERVADO',
  CONFIRMADO = 'CONFIRMADO',
  ATENDIDO = 'ATENDIDO',
  CANCELADO = 'CANCELADO',
}

@Entity('turnos')
export class Turno {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Paciente, { onDelete: 'RESTRICT' })
@JoinColumn({ name: 'paciente_id' })
paciente: Paciente;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'medico_id' })
  medico: Usuario;

  @Column({ type: 'timestamptz', name: 'fecha_hora' })
  fechaHora: Date;

  @Column({ type: 'enum', enum: EstadoTurno, default: EstadoTurno.DISPONIBLE })
  estado: EstadoTurno;

  @VersionColumn()
  version: number;
}