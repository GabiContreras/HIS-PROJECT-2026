export interface RegistroClinicoData {
  id: string;
  categoria: string;
  titulo: string | null;
  detalle: string;
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

export interface HistoriaClinicaRepository {
  create(data: NuevoRegistroClinico): Promise<RegistroClinicoData>;
  listByPaciente(pacienteId: string): Promise<RegistroClinicoData[]>;
}

export const HISTORIA_CLINICA_REPOSITORY = Symbol('HISTORIA_CLINICA_REPOSITORY');
