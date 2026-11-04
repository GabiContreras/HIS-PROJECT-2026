import { CoverageType } from '../shared/events/coverage-type.js';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum TipoAtencionFacturable {
  REGULAR = 'REGULAR',
  URGENCIA = 'URGENCIA',
}

@Entity('cargos')
export class Cargo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'turno_id', type: 'uuid', unique: true })
  turnoId: string;

  @Column({ name: 'importe_pesos', type: 'integer' })
  importePesos: number;

  @Column({ name: 'tipo_atencion', type: 'varchar', length: 20 })
  tipoAtencion: TipoAtencionFacturable;

  /** Cobertura del paciente al momento de facturar (queda congelada en el cargo). null: cargo anterior al registro de coberturas. */
  @Column({ name: 'tipo_cobertura', type: 'varchar', length: 30, nullable: true })
  tipoCobertura: CoverageType | null;

  @Column({ name: 'entidad_cobertura', type: 'varchar', length: 100, nullable: true })
  entidadCobertura: string | null;

  /** Parte que paga el paciente (copago, o el 100% si es particular). */
  @Column({ name: 'importe_paciente_pesos', type: 'integer', nullable: true })
  importePacientePesos: number | null;

  /** Parte a cargo de un tercero: el Estado (obra social pública) o la prepaga. */
  @Column({ name: 'importe_tercero_pesos', type: 'integer', nullable: true })
  importeTerceroPesos: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
