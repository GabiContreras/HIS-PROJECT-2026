import { CoverageType } from '../shared/events/coverage-type.js';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { EstadoCargo } from '../modules/billing/domain/estado-cargo.js';
import { TipoAtencionFacturable } from '../modules/billing/domain/tipo-atencion-facturable.js';

export { EstadoCargo, TipoAtencionFacturable };

@Entity('cargos')
export class Cargo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({name: 'turno_id',type: 'uuid',unique: true,nullable: true,})
  turnoId: string | null;

  @Column({name: 'administration_id',type: 'uuid',nullable: true,})
  administrationId: string | null;

  @Column({ name: 'concepto', type: 'varchar', length: 100, nullable: true })
  concepto: string | null;

  @Column({ name: 'importe_pesos', type: 'integer' })
  importePesos: number;

  @Column({ name: 'tipo_atencion', type: 'varchar', length: 20 })
  tipoAtencion: TipoAtencionFacturable;


  @Column({ name: 'tipo_cobertura', type: 'varchar', length: 30, nullable: true })
  tipoCobertura: CoverageType | null;

  @Column({ name: 'entidad_cobertura', type: 'varchar', length: 100, nullable: true })
  entidadCobertura: string | null;


  @Column({ name: 'importe_paciente_pesos', type: 'integer', nullable: true })
  importePacientePesos: number | null;


  @Column({ name: 'importe_tercero_pesos', type: 'integer', nullable: true })
  importeTerceroPesos: number | null;

  @Column({ name: 'estado', type: 'varchar', length: 20, default: EstadoCargo.PENDIENTE })
  estado: EstadoCargo;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
