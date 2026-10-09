import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn , JoinColumn } from 'typeorm';
import { Paciente } from './paciente.entity.js';
import { Usuario } from './usuario.entity.js';

@Entity('signos_vitales')
export class SignoVital {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Paciente, { onDelete: 'CASCADE' })
@JoinColumn({ name: 'paciente_id' })
paciente: Paciente;


  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
@JoinColumn({ name: 'registrado_por_id' })
registradoPor: Usuario;

  @Column()
  tipo: string;

  @Column({ type: 'float' })
  valor: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'fecha_hora' })
fechaHora: Date;
}
