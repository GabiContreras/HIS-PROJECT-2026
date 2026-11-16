import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  VersionColumn,
  JoinColumn,
} from 'typeorm';
import { Paciente } from './paciente.entity.js';
import { Usuario } from './usuario.entity.js';

import { EstadoTurno } from '../modules/admissions/domain/states/estado-turno.js';

export { EstadoTurno };

@Entity('turnos')
export class Turno {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Paciente, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'paciente_id' })
  paciente: Paciente;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'medico_id' })
 
  medico: Usuario;

  @Column({ name: 'fecha_hora', type: 'timestamptz' })
  fechaHora: Date;

  @Column({ type: 'integer', default: 30 })
  duracionMinutos: number;

  @Column({ type: 'boolean', default: false })
  urgente: boolean;

    @Column({
    type: 'enum',
    enum: EstadoTurno,
    enumName: 'estado_turno',
    default: EstadoTurno.DISPONIBLE,
  })
  estado: EstadoTurno;

    @Column({ name: 'motivo_cancelacion', type: 'varchar', length: 200, nullable: true })
  motivoCancelacion: string | null;

  @Column({ name: 'cancelado_por_id', type: 'uuid', nullable: true })
  canceladoPorId: string | null;

  @Column({ name: 'cancelado_en', type: 'timestamptz', nullable: true })
  canceladoEn: Date | null;

  @VersionColumn()
  version: number;
}
