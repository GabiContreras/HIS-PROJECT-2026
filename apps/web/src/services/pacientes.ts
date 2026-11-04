
const API_URL = 'http://localhost:3000';

export interface Paciente {
  id: string;
  nombre: string;
  apellido: string;
  documento: string;
  fechaNacimiento: string;
  telefono?: string | null;
}

export interface CrearPacienteInput {
  nombre: string;
  apellido: string;
  documento: string;
  fechaNacimiento: string;
  telefono?: string;
}

export async function crearPaciente(
  datos: CrearPacienteInput,
): Promise<Paciente> {
  const res = await fetch(`${API_URL}/pacientes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });

  if (!res.ok) {
    if (res.status === 409) {
      throw new Error('Ya existe un paciente con ese documento.');
    }

    if (res.status === 400) {
      throw new Error('Revisá los datos ingresados.');
    }

    throw new Error('No se pudo registrar el paciente.');
  }

  return res.json();
}
