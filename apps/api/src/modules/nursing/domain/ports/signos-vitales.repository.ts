export interface SignoVitalData {
  id: string;
  pacienteId: string;
  paciente: string;
  tipo: string;
  valor: number;
  fechaHora: Date;
  controlId: string | null;
  registradoPor: string;
}

export interface NuevoSignoVital {
  pacienteId: string;
  registradoPorId: string;
  tipo: string;
  valor: number;
}

export interface NuevoControl {
  pacienteId: string;
  registradoPorId: string;
  lecturas: { tipo: string; valor: number }[];
}

export interface SignosVitalesRepository {
  create(data: NuevoSignoVital): Promise<SignoVitalData>;
  list(pacienteId: string | undefined, limit: number): Promise<SignoVitalData[]>;
  createControl(data: NuevoControl): Promise<SignoVitalData[]>;
  listControles(pacienteId: string | undefined, limit: number): Promise<SignoVitalData[]>;
}

export const SIGNOS_VITALES_REPOSITORY = Symbol('SIGNOS_VITALES_REPOSITORY');
