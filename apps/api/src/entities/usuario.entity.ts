import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum RolUsuario {
  MEDICO = 'MEDICO',
  ENFERMERO = 'ENFERMERO',
  ADMINISTRATIVO = 'ADMINISTRATIVO',
}

export enum EstadoCuenta {
  PENDIENTE_VERIFICACION = 'PENDIENTE_VERIFICACION',
  PENDIENTE_HABILITACION = 'PENDIENTE_HABILITACION',
  ACTIVO = 'ACTIVO',
  DESHABILITADO = 'DESHABILITADO',
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

  @Column({ type: 'varchar', default: EstadoCuenta.PENDIENTE_VERIFICACION })
  estado: EstadoCuenta;

  @Column({ type: 'boolean', default: false })
  emailVerificado: boolean;

  /** Horario laboral (HH:MM:SS, hora de la clínica). Solo se usa para médicos. */
  @Column({ type: 'time', default: '08:00' })
  horaInicio: string;

  @Column({ type: 'time', default: '20:00' })
  horaFin: string;

  @Column({ type: 'boolean', default: false })
  esSuperadmin: boolean;

  @Column({ type: 'integer', default: 0 })
  intentosFallidos: number;

  @Column({ type: 'timestamptz', nullable: true })
  bloqueadoHasta: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
