import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Paciente } from './paciente.entity.js';
import { Usuario } from './usuario.entity.js';

@Entity('signos_vitales')
export class SignoVital {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Paciente, { onDelete: 'CASCADE' })
paciente: Paciente;


  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
registradoPor: Usuario;

  @Column()
  tipo: string;

  @Column({ type: 'float' })
  valor: number;

  @CreateDateColumn({ type: 'timestamptz' })
fechaHora: Date;
}
