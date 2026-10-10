import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { IndicacionMedica } from './indicacion-medica.entity.js';
import { Usuario } from './usuario.entity.js';

@Entity('administraciones_medicacion')
export class AdministracionMedicacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => IndicacionMedica, { onDelete: 'CASCADE' })
indicacion: IndicacionMedica;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  enfermero: Usuario;

  @CreateDateColumn({ type: 'timestamptz' })
  fechaHoraAdministracion: Date;

  @Column({ nullable: true })
  observaciones: string;
}
