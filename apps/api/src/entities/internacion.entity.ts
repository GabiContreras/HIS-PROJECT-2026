import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('internaciones')
export class Internacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'cama_id', type: 'uuid' })
  camaId: string;

  @Column({ name: 'medico_id', type: 'uuid' })
  medicoId: string;

  @Column({ name: 'motivo_ingreso', type: 'varchar', length: 200, nullable: true })
  motivoIngreso: string | null;

  @CreateDateColumn({ name: 'fecha_ingreso', type: 'timestamptz' })
  fechaIngreso: Date;

  @Column({ name: 'fecha_egreso', type: 'timestamptz', nullable: true })
  fechaEgreso: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}