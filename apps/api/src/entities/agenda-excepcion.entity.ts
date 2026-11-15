import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum TipoExcepcion {
  AUSENCIA = 'AUSENCIA',
  FERIADO = 'FERIADO',
}

@Entity('agenda_excepcion')
export class AgendaExcepcion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'medico_id', type: 'uuid', nullable: true })
  medicoId: string | null;

  @Column({ name: 'fecha', type: 'date' })
  fecha: string;

  @Column({ name: 'tipo', type: 'varchar', length: 20 })
  tipo: TipoExcepcion;

  @Column({ name: 'motivo', type: 'varchar', length: 200, nullable: true })
  motivo: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}