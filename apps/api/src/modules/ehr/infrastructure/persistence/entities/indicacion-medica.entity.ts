import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Paciente } from '../../../../admissions/infrastructure/persistence/entities/paciente.entity.js';
import { Usuario } from '../../../../iam/infrastructure/persistence/entities/usuario.entity.js';
import { Insumo } from '../../../../resources/infrastructure/persistence/entities/insumo.entity.js';

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

  
  @Column({ type: 'int', nullable: true })
  frecuenciaHoras: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  fechaInicio: Date;

  @Column({ type: 'timestamptz', nullable: true })
  fechaFin: Date;
}