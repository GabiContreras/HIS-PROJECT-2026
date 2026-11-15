export interface IndicacionData {
  id: string;
  pacienteId: string;
  /** "Apellido, Nombre" del paciente. */
  paciente: string;
  medicoId: string;
  insumoId: string | null;
  insumo: string | null;
  tipo: string;
  estado: string;
  internacionId: string | null;
  motivoSuspension: string | null;
  dosis: string;
  /** Texto legible (ej. "cada 8 horas"). */
  frecuencia: string;
  /** Null en filas anteriores a la migración de frecuencia estructurada. */
  frecuenciaHoras: number | null;
  fechaInicio: Date;
  fechaFin: Date | null;
}

export interface AdministracionData {
  id: string;
  indicacionId: string;
  enfermeroId: string;
  /** "Apellido, Nombre" del enfermero. */
  enfermero: string;
  fechaHoraAdministracion: Date;
  observaciones: string | null;
  dosisProgramadaPara: Date | null;
  resultado: 'ADMINISTRADA' | 'OMITIDA';
  motivoOmision: string | null;
}

export interface NuevaIndicacion {
  pacienteId: string;
  medicoId: string;
  insumoId: string | null;
  tipo: string;
  internacionId: string | null;
  dosis: string;
  frecuencia: string;
  frecuenciaHoras: number;
  fechaFin: Date | null;
}

export interface NuevaAdministracion {
  enfermeroId: string;
  fechaHoraAdministracion: Date;
  observaciones: string | null;
  dosisProgramadaPara: Date | null;
  resultado: 'ADMINISTRADA' | 'OMITIDA';
  motivoOmision: string | null;
}

export interface DecisionAdministracion {
  nueva?: NuevaAdministracion;
  existente?: AdministracionData;
}

export interface IndicacionConAdministraciones {
  indicacion: IndicacionData;
  administraciones: AdministracionData[];
}

/** Estado leído bajo bloqueo de la fila de la indicación, dentro de la transacción. */
export interface ContextoAdministracion {
  indicacion: IndicacionData | null;
  administraciones: AdministracionData[];
}

export interface IndicacionesRepository {
  insumoExiste(insumoId: string): Promise<boolean>;
  obtenerNombreInsumo(insumoId: string): Promise<string | null>;
  internacionPertenece(internacionId: string, pacienteId: string): Promise<boolean>;
  create(data: NuevaIndicacion): Promise<IndicacionData>;
  /**
   * Indicaciones vigentes en `ahora` (iniciadas y sin vencer) con sus administraciones
   * registradas desde `administracionesDesde`.
   */
  listarActivas(
    pacienteId: string | undefined,
    ahora: Date,
    administracionesDesde: Date,
    limit: number,
  ): Promise<IndicacionConAdministraciones[]>;
  /**
   * Abre una transacción, bloquea la fila de la indicación (FOR UPDATE, sin joins) y llama a
   * `decidir` con el estado actual. Si `decidir` devuelve datos los guarda en la misma transacción;
   * si lanza, hace rollback. Serializa confirmaciones concurrentes de la misma indicación.
   */
  administrarBajoBloqueo(
    indicacionId: string,
    decidir: (contexto: ContextoAdministracion) => DecisionAdministracion,
  ): Promise<{ indicacion: IndicacionData; administracion: AdministracionData; creada: boolean }>;
  cambiarEstado(
    indicacionId: string,
    estado: 'SUSPENDIDA' | 'FINALIZADA',
    usuarioId: string,
    motivo: string,
  ): Promise<IndicacionData | null>;
}

export const INDICACIONES_REPOSITORY = Symbol('INDICACIONES_REPOSITORY');
