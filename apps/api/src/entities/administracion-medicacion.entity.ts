import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, JoinColumn } from 'typeorm';
import { IndicacionMedica } from './indicacion-medica.entity.js';
import { Usuario } from './usuario.entity.js';

@Entity('administraciones_medicacion')
export class AdministracionMedicacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => IndicacionMedica, { onDelete: 'CASCADE' })
@JoinColumn({ name: 'indicacion_id' })
indicacion: IndicacionMedica;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
@JoinColumn({ name: 'enfermero_id' })
  enfermero: Usuario;

  @CreateDateColumn({ type: 'timestamptz', name: 'fecha_hora_administracion' })
  fechaHoraAdministracion: Date;

  @Column({ nullable: true })
  observaciones: string;
}
