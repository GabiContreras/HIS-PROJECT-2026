import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum RolUsuario {
  MEDICO = 'MEDICO',
  ENFERMERO = 'ENFERMERO',
  ADMINISTRATIVO = 'ADMINISTRATIVO',
}

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column()
  apellido: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
passwordHash: string;

  @Column({ type: 'enum', enum: RolUsuario })
  rol: RolUsuario;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
createdAt: Date;
}
