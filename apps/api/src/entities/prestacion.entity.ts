import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('prestaciones')
export class Prestacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'codigo', type: 'varchar', length: 50, unique: true })
  codigo: string;

  @Column({ name: 'nombre', type: 'varchar', length: 100 })
  nombre: string;

  @Column({ name: 'valor_base_pesos', type: 'integer' })
  valorBasePesos: number;

  @Column({ name: 'copago_pesos', type: 'integer' })
  copagoPesos: number;

  @Column({ name: 'activo', type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
