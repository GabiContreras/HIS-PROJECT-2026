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

  /** Motivo o diagnóstico inicial informado al asignar la cama; null si no se informó. */
  @Column({ name: 'motivo_ingreso', type: 'varchar', length: 200, nullable: true })
  motivoIngreso: string | null;

  /** La BD la completa con now() al insertar. */
  @CreateDateColumn({ name: 'fecha_ingreso', type: 'timestamptz' })
  fechaIngreso: Date;

  /** null = internación activa. */
  @Column({ name: 'fecha_egreso', type: 'timestamptz', nullable: true })
  fechaEgreso: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}