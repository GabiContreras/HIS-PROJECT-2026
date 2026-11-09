import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('notificaciones')
export class NotificacionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'destinatario_id' })
  destinatarioId: string;

  @Column()
  tipo: string;

  @Column({ default: 'MEDIA' })
  prioridad: string; 

  @Column('text')
  mensaje: string;

  @Column({ default: false })
  leida: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}