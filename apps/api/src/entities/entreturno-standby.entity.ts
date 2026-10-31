import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Paciente } from './paciente.entity.js';
import { Turno } from './turno.entity.js';
import { Usuario } from './usuario.entity.js';

export enum EstadoStandby {
  EN_COLA = 'EN_COLA',
  ASIGNADO = 'ASIGNADO',
  RETIRADO = 'RETIRADO',
}

/** Lista de espera de entreturnos (HU 1.3): cola FIFO por médico y día. */
@Entity('entreturno_standby')
export class EntreturnoStandby {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'medico_id' })
  medico: Usuario;

  @ManyToOne(() => Paciente, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'paciente_id' })
  paciente: Paciente;

  /** Día de la clínica (AAAA-MM-DD) para el que espera un horario. */
  @Column({ type: 'date' })
  fecha: string;

  @Column({ type: 'varchar', length: 20, default: EstadoStandby.EN_COLA })
  estado: EstadoStandby;

  /** Turno que se le asignó al promoverlo. */
  @ManyToOne(() => Turno, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'turno_id' })
  turno: Turno | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
