import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Paciente } from './paciente.entity.js';
import { Usuario } from './usuario.entity.js';

@Entity('registros_clinicos')
export class RegistroClinico {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Paciente, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'paciente_id' })
  paciente: Paciente;

  @Column()
  categoria: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  titulo: string | null;

  @Column({ type: 'text' })
  detalle: string;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'registrado_por_id' })
  registradoPor: Usuario;

  @CreateDateColumn({ type: 'timestamptz', name: 'fecha_hora' })
  fechaHora: Date;
}
