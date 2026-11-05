import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { ProtocoloIngreso } from './protocolo-ingreso.entity.js';
import { Usuario } from './usuario.entity.js';

@Entity('tareas_protocolo')
export class TareaProtocolo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ProtocoloIngreso, (protocolo) => protocolo.tareas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'protocolo_id' })
  /** `Relation<>` evita el error de inicialización por la importación circular entre entidades (ESM). */
  protocolo: Relation<ProtocoloIngreso>;

  @Column({ type: 'int' })
  orden: number;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ type: 'int', nullable: true, name: 'frecuencia_horas' })
  frecuenciaHoras: number | null;

  /** Casilla del checklist de enfermería. Coherente con `hechaEn` (CHECK en base). */
  @Column({ type: 'boolean', default: false })
  hecha: boolean;

  @Column({ type: 'timestamptz', nullable: true, name: 'hecha_en' })
  hechaEn: Date | null;

  @ManyToOne(() => Usuario, { nullable: true, onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'hecha_por_id' })
  hechaPor: Usuario | null;
}
