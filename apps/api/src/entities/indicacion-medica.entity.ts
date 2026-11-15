import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, ManyToOne, CreateDateColumn } from 'typeorm';
import { Paciente } from './paciente.entity.js';
import { Usuario } from './usuario.entity.js';
import { Insumo } from './insumo.entity.js';
import { Internacion } from './internacion.entity.js';

export enum TipoIndicacion {
  MEDICACION = 'MEDICACION',
  DIETA = 'DIETA',
  CURACION = 'CURACION',
  ESTUDIO = 'ESTUDIO',
  CUIDADO = 'CUIDADO',
}

export enum EstadoIndicacion {
  ACTIVA = 'ACTIVA',
  SUSPENDIDA = 'SUSPENDIDA',
  FINALIZADA = 'FINALIZADA',
}

@Entity('indicaciones_medicas')
export class IndicacionMedica {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Paciente, { onDelete: 'CASCADE' })
paciente: Paciente;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  medico: Usuario;

  @ManyToOne(() => Insumo, { nullable: true, onDelete: 'RESTRICT' })
  insumo: Insumo | null;

  @Column({ type: 'varchar', length: 20, default: TipoIndicacion.MEDICACION })
  tipo: TipoIndicacion;

  @Column({ type: 'varchar', length: 20, default: EstadoIndicacion.ACTIVA })
  estado: EstadoIndicacion;

  @ManyToOne(() => Usuario, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'suspendida_por_id' })
  suspendidaPor: Usuario | null;

  @Column({ name: 'motivo_suspension', type: 'varchar', length: 500, nullable: true })
  motivoSuspension: string | null;

  @ManyToOne(() => Internacion, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'internacion_id' })
  internacion: Internacion | null;

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
