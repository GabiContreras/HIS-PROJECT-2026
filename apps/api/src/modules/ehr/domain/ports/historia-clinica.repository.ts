export interface RegistroClinicoData {
  id: string;
  categoria: string;
  titulo: string | null;
  detalle: string;
  /** "Apellido, Nombre" de quien lo registró. */
  registradoPor: string;
  fechaHora: Date;
}

export interface NuevoRegistroClinico {
  pacienteId: string;
  registradoPorId: string;
  categoria: string;
  titulo: string | null;
  detalle: string;
}

/** Solo altas y consultas: la historia clínica es inmutable. */
export interface HistoriaClinicaRepository {
  create(data: NuevoRegistroClinico): Promise<RegistroClinicoData>;
  /** Registros del paciente, del más nuevo al más viejo. */
  listByPaciente(pacienteId: string): Promise<RegistroClinicoData[]>;
}

export const HISTORIA_CLINICA_REPOSITORY = Symbol('HISTORIA_CLINICA_REPOSITORY');
