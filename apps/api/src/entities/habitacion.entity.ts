import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Sector } from './sector.entity.js';

@Entity('habitaciones')
@Unique('uq_habitaciones_sector_numero', ['sector', 'numero'])
export class Habitacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Sector, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sector_id' })
  sector: Sector;

  @Column({ type: 'varchar', length: 50 })
  numero: string;

  @Column({ type: 'integer' })
  capacidad: number;

  @Column({ type: 'boolean', default: true })
  activo: boolean;
}
