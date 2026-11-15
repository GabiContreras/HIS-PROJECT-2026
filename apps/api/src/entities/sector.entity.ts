import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('sectores')
export class Sector {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  nombre: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;
}
