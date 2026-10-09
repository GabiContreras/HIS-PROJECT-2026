import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('pacientes')
export class Paciente {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column()
  apellido: string;

  @Column({ unique: true })
  documento: string;

  @Column({ type: 'date', name: 'fecha_nacimiento' })
fechaNacimiento: string;

  @Column({ nullable: true })
  telefono: string;
}
