import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { CoverageType } from '../../../../../shared/events/coverage-type.js';

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
}
