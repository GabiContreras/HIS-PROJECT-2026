import { Entity, PrimaryColumn } from 'typeorm';

@Entity('medico_especialidad')
export class MedicoEspecialidad {
  @PrimaryColumn({ name: 'medico_id', type: 'uuid' })
  medicoId: string;

  @PrimaryColumn({ name: 'especialidad_id', type: 'uuid' })
  especialidadId: string;
}