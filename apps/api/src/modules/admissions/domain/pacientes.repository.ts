
import type { Paciente } from './paciente.js';

export const PACIENTES_REPOSITORY = Symbol('PACIENTES_REPOSITORY');

export interface PacientesRepository {
  buscarPorDocumento(documento: string): Promise<Paciente | null>;

  guardar(paciente: Paciente): Promise<Paciente>;
}
