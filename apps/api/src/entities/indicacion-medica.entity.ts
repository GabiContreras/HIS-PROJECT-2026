import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, JoinColumn } from 'typeorm';
import { Paciente } from './paciente.entity.js';
import { Usuario } from './usuario.entity.js';
import { Insumo } from './insumo.entity.js';

@Entity('indicaciones_medicas')
export class IndicacionMedica {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Paciente, { onDelete: 'CASCADE' })
@JoinColumn({ name: 'paciente_id' })
paciente: Paciente;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
@JoinColumn({ name: 'medico_id' })
  medico: Usuario;

  @ManyToOne(() => Insumo, { onDelete: 'RESTRICT' })
@JoinColumn({ name: 'insumo_id' })
  insumo: Insumo;

  @Column()
  dosis: string;

  @Column()
  frecuencia: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'fecha_inicio' })
  fechaInicio: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'fecha_fin' })
  fechaFin: Date;
}
