export interface SignoVitalData {
  id: string;
  pacienteId: string;
  /** "Apellido, Nombre" del paciente, para mostrar en listados. */
  paciente: string;
  tipo: string;
  valor: number;
  fechaHora: Date;
  /** Control al que pertenece la medición; nulo en registros sueltos. */
  controlId: string | null;
  internacionId: string | null;
  /** "Apellido, Nombre" de quien registró la medición. */
  registradoPor: string;
}

export interface NuevoSignoVital {
  pacienteId: string;
  registradoPorId: string;
  tipo: string;
  valor: number;
  internacionId: string | null;
}

export interface NuevoControl {
  pacienteId: string;
  registradoPorId: string;
  lecturas: { tipo: string; valor: number }[];
  internacionId: string | null;
}

export interface SignosVitalesRepository {
  create(data: NuevoSignoVital): Promise<SignoVitalData>;
  list(
    pacienteId: string | undefined,
    internacionId: string | undefined,
    limit: number,
  ): Promise<SignoVitalData[]>;
  /** Guarda todas las lecturas del control o ninguna: una sola transacción con un mismo `controlId`. */
  createControl(data: NuevoControl): Promise<SignoVitalData[]>;
  /** Mediciones que pertenecen a un control, de la más nueva a la más vieja. */
  listControles(
    pacienteId: string | undefined,
    internacionId: string | undefined,
    limit: number,
  ): Promise<SignoVitalData[]>;
  listSerie(
    pacienteId: string,
    tipo: string | undefined,
    internacionId: string | undefined,
    limit: number,
  ): Promise<SignoVitalData[]>;
  internacionPertenece(internacionId: string, pacienteId: string): Promise<boolean>;
}

export const SIGNOS_VITALES_REPOSITORY = Symbol('SIGNOS_VITALES_REPOSITORY');
