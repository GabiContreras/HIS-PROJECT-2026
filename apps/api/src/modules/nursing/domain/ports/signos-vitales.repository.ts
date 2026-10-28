export interface SignoVitalData {
  id: string;
  pacienteId: string;
  /** "Apellido, Nombre" del paciente, para mostrar en listados. */
  paciente: string;
  tipo: string;
  valor: number;
  fechaHora: Date;
}

export interface NuevoSignoVital {
  pacienteId: string;
  registradoPorId: string;
  tipo: string;
  valor: number;
}

export interface SignosVitalesRepository {
  create(data: NuevoSignoVital): Promise<SignoVitalData>;
  list(pacienteId: string | undefined, limit: number): Promise<SignoVitalData[]>;
}

export const SIGNOS_VITALES_REPOSITORY = Symbol('SIGNOS_VITALES_REPOSITORY');
