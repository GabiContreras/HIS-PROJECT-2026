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

  @Column({ type: 'date' })
fechaNacimiento: string;

  @Column({ nullable: true })
  telefono: string;
}
