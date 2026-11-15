import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Paciente } from './paciente.entity.js';
import { Usuario } from './usuario.entity.js';

export enum EstadoEstudio {
  SOLICITADO = 'SOLICITADO',
  REALIZADO = 'REALIZADO',
  INFORMADO = 'INFORMADO',
}

@Entity('estudios')
export class Estudio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Paciente, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'paciente_id' })
  paciente: Paciente;

  @Column({ type: 'varchar', length: 120 })
  tipo: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  fecha: Date;

  @Column({ type: 'varchar', length: 20, default: EstadoEstudio.INFORMADO })
  estado: EstadoEstudio;

  @Column({ type: 'text' })
  informe: string;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'solicitante_id' })
  solicitante: Usuario;

  @Column({ name: 'storage_key', type: 'varchar', length: 100 })
  storageKey: string;

  @Column({ name: 'nombre_adjunto', type: 'varchar', length: 255 })
  nombreAdjunto: string;

  @Column({ name: 'media_type', type: 'varchar', length: 100 })
  mediaType: string;

  @Column({ name: 'tamano_bytes', type: 'bigint' })
  tamanoBytes: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
