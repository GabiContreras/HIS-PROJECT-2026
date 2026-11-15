export interface RegistroClinicoData {
  id: string;
  categoria: string;
  titulo: string | null;
  detalle: string;
  /** "Apellido, Nombre" de quien lo registró. */
  registradoPor: string;
  fechaHora: Date;
  corrigeA: string | null;
  rectificado: boolean;
  turnoId: string | null;
  internacionId: string | null;
}

export interface NuevoRegistroClinico {
  pacienteId: string;
  registradoPorId: string;
  categoria: string;
  titulo: string | null;
  detalle: string;
  corrigeA?: string | null;
  turnoId?: string | null;
  internacionId?: string | null;
}

/** Solo altas y consultas: la historia clínica es inmutable. */
export interface HistoriaClinicaRepository {
  create(data: NuevoRegistroClinico): Promise<RegistroClinicoData>;
  /** Registros del paciente, del más nuevo al más viejo. */
  listByPaciente(pacienteId: string): Promise<RegistroClinicoData[]>;
  getByPacienteAndId(pacienteId: string, registroId: string): Promise<RegistroClinicoData | null>;
  timeline(pacienteId: string): Promise<TimelineEntry[]>;
  validarContexto(pacienteId: string, turnoId?: string, internacionId?: string): Promise<boolean>;
}

export interface TimelineEntry {
  id: string;
  tipo: 'REGISTRO_CLINICO' | 'INTERNACION' | 'SIGNO_VITAL' | 'MEDICACION' | 'TURNO';
  fechaHora: Date;
  titulo: string;
  detalle: string;
}

export const HISTORIA_CLINICA_REPOSITORY = Symbol('HISTORIA_CLINICA_REPOSITORY');
