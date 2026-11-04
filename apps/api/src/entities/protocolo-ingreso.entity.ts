import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Paciente } from './paciente.entity.js';
import { TareaProtocolo } from './tarea-protocolo.entity.js';

@Entity('protocolos_ingreso')
export class ProtocoloIngreso {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Identificador del ingreso/internación que originó el protocolo; clave de idempotencia (único). */
  @Column({ type: 'uuid', name: 'ingreso_id', unique: true })
  ingresoId: string;

  @ManyToOne(() => Paciente, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'paciente_id' })
  paciente: Paciente;

  @Column()
  tipo: string;

  @Column({ type: 'text', name: 'motivo_ingreso' })
  motivoIngreso: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'generado_en' })
  generadoEn: Date;

  @OneToMany(() => TareaProtocolo, (tarea) => tarea.protocolo, { cascade: ['insert'] })
  tareas: TareaProtocolo[];
}
