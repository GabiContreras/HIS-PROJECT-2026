import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('auditoria')
export class Auditoria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id', type: 'uuid', nullable: true })
  usuarioId: string | null;

  @Column({ name: 'accion', type: 'varchar', length: 60 })
  accion: string;

  @Column({ name: 'recurso', type: 'varchar', length: 120 })
  recurso: string;

  @Column({ name: 'paciente_id', type: 'uuid', nullable: true })
  pacienteId: string | null;

  @Column({ name: 'metodo', type: 'varchar', length: 10 })
  metodo: string;

  @Column({ name: 'ruta', type: 'varchar', length: 255 })
  ruta: string;

  @Column({ name: 'estado_http', type: 'integer' })
  estadoHttp: number;

  @Column({ name: 'ip', type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ name: 'detalle', type: 'varchar', length: 255, nullable: true })
  detalle: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}