import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { IndicacionMedica } from './indicacion-medica.entity.js';
import { Usuario } from './usuario.entity.js';

export enum ResultadoAdministracion {
  ADMINISTRADA = 'ADMINISTRADA',
  OMITIDA = 'OMITIDA',
}

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

  @Column({ name: 'dosis_programada_para', type: 'timestamptz', nullable: true })
  dosisProgramadaPara: Date | null;

  @Column({ type: 'varchar', length: 20, default: ResultadoAdministracion.ADMINISTRADA })
  resultado: ResultadoAdministracion;

  @Column({ name: 'motivo_omision', type: 'varchar', length: 500, nullable: true })
  motivoOmision: string | null;
}
