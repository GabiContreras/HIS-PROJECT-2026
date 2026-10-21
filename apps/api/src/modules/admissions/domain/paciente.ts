
export interface Paciente {
  id?: string;
  nombre: string;
  apellido: string;
  documento: string;
  fechaNacimiento: string;
  telefono?: string | null;
}
