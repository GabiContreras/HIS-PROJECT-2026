import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { CoverageType } from '../shared/events/coverage-type.js';
import { Financiador } from './financiador.entity.js';
import { Plan } from './plan.entity.js';

@Entity('pacientes')
export class Paciente {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'varchar', length: 100 })
  apellido: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  documento: string;

  @Column({ type: 'date', name: 'fecha_nacimiento' })
  fechaNacimiento: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefono: string;

  /** Define cómo se factura la atención (HU de Facturación: estrategia por cobertura). */
  @Column({
    name: 'tipo_cobertura',
    type: 'varchar',
    length: 30,
    default: CoverageType.SELF_PAY,
  })
  tipoCobertura: CoverageType;

  /** Nombre de la prepaga u obra social. Obligatorio en prepaga; el copago depende de ella. */
  @Column({ name: 'entidad_cobertura', type: 'varchar', length: 100, nullable: true })
  entidadCobertura: string | null;

  @Column({ name: 'financiador_id', type: 'uuid', nullable: true })
  financiadorId: string | null;

  @Column({ name: 'plan_id', type: 'uuid', nullable: true })
  planId: string | null;

  @Column({ name: 'numero_afiliado', type: 'varchar', length: 30, nullable: true })
  numeroAfiliado: string | null;

  @ManyToOne(() => Financiador, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'financiador_id' })
  financiador: Financiador | null;

  @ManyToOne(() => Plan, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'plan_id' })
  plan: Plan | null;
}
