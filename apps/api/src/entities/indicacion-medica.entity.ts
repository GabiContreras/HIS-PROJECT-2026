import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Paciente } from './paciente.entity.js';
import { Usuario } from './usuario.entity.js';
import { Insumo } from './insumo.entity.js';

@Entity('indicaciones_medicas')
export class IndicacionMedica {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Paciente, { onDelete: 'CASCADE' })
paciente: Paciente;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  medico: Usuario;

  @ManyToOne(() => Insumo, { onDelete: 'RESTRICT' })
  insumo: Insumo;

  @Column()
  dosis: string;

  @Column()
  frecuencia: string;

  /** Frecuencia estructurada en horas. NULL en filas anteriores a la migración AddFrecuenciaHoras. */
  @Column({ type: 'int', nullable: true })
  frecuenciaHoras: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  fechaInicio: Date;

  @Column({ type: 'timestamptz', nullable: true })
  fechaFin: Date;
}
