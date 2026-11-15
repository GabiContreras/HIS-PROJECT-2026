import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, ManyToOne, CreateDateColumn } from 'typeorm';
import { Paciente } from './paciente.entity.js';
import { Usuario } from './usuario.entity.js';
import { Internacion } from './internacion.entity.js';

@Entity('signos_vitales')
export class SignoVital {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Paciente, { onDelete: 'CASCADE' })
paciente: Paciente;


  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'registrado_por_id' })
  registradoPor: Usuario;

  @ManyToOne(() => Internacion, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'internacion_id' })
  internacion: Internacion | null;

  @Column()
  tipo: string;

  @Column({ type: 'float' })
  valor: number;

  /** Agrupa los valores de un mismo control de signos vitales; nulo en registros sueltos. */
  @Column({ type: 'uuid', nullable: true })
  controlId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
fechaHora: Date;
}
