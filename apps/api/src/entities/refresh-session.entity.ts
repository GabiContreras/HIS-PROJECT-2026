import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from './usuario.entity.js';

@Entity('refresh_sessions')
export class RefreshSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuarioId' })
  usuario: Usuario;

  @Column({ type: 'uuid' })
  usuarioId: string;

  @Column({ type: 'uuid' })
  familiaId: string;

  @Column({ unique: true })
  tokenHash: string;

  @Column({ type: 'timestamptz' })
  expiraEn: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revocadoEn: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
