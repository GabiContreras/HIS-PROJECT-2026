import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum TipoAtencionFacturable {
  REGULAR = 'REGULAR',
  URGENCIA = 'URGENCIA',
}

@Entity('cargos')
export class Cargo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'turno_id', type: 'uuid', unique: true })
  turnoId: string;

  @Column({ name: 'importe_pesos', type: 'integer' })
  importePesos: number;

  @Column({ name: 'tipo_atencion', type: 'varchar', length: 20 })
  tipoAtencion: TipoAtencionFacturable;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
