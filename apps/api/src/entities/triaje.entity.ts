import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { NivelTriage } from '../modules/admissions/api/dto/crear-triage.dto.js';
import { Paciente } from './paciente.entity.js';

export enum EstadoTriaje {
  EN_COLA = 'EN_COLA',
  ATENDIDO = 'ATENDIDO',
}

@Entity('triajes')
export class TriajeRegistro {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  pacienteId: string;

  @ManyToOne(() => Paciente, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'paciente_id' })
  paciente: Paciente;

  @Column({ type: 'varchar', length: 20 })
  nivel: NivelTriage;

  @Column({ type: 'text' })
  motivoConsulta: string;

  @Column({ type: 'varchar', length: 20, default: EstadoTriaje.EN_COLA })
  estado: EstadoTriaje;

  @Column({ type: 'uuid' })
  registradoPorId: string;

  @Column({ type: 'uuid', nullable: true })
  medicoDestinoId: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  llegadaAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  atendidoAt: Date | null;
}
