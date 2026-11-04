import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('insumos')
export class Insumo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  nombre: string;

  @Column()
unidadMedida: string;

  @Column({ type: 'int', default: 0 })
cantidadDisponible: number;
}
