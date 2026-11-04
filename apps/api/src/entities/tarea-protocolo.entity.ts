import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { ProtocoloIngreso } from './protocolo-ingreso.entity.js';

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
}
