export interface IndicacionData {
  id: string;
  pacienteId: string;
  paciente: string;
  medicoId: string;
  insumoId: string;
  insumo: string;
  dosis: string;
  frecuencia: string;
  frecuenciaHoras: number | null;
  fechaInicio: Date;
  fechaFin: Date | null;
}

export interface AdministracionData {
  id: string;
  indicacionId: string;
  enfermeroId: string;
  enfermero: string;
  fechaHoraAdministracion: Date;
  observaciones: string | null;
}

export interface NuevaIndicacion {
  pacienteId: string;
  medicoId: string;
  insumoId: string;
  dosis: string;
  frecuencia: string;
  frecuenciaHoras: number;
  fechaFin: Date | null;
}

export interface NuevaAdministracion {
  enfermeroId: string;
  fechaHoraAdministracion: Date;
  observaciones: string | null;
}

export interface IndicacionConAdministraciones {
  indicacion: IndicacionData;
  administraciones: AdministracionData[];
}

export interface ContextoAdministracion {
  indicacion: IndicacionData | null;
  administraciones: AdministracionData[];
}

export interface IndicacionesRepository {
  insumoExiste(insumoId: string): Promise<boolean>;
  create(data: NuevaIndicacion): Promise<IndicacionData>;
  listarActivas(
    pacienteId: string | undefined,
    ahora: Date,
    administracionesDesde: Date,
    limit: number,
  ): Promise<IndicacionConAdministraciones[]>;
  administrarBajoBloqueo(
    indicacionId: string,
    decidir: (contexto: ContextoAdministracion) => NuevaAdministracion,
  ): Promise<{ indicacion: IndicacionData; administracion: AdministracionData }>;
}

export const INDICACIONES_REPOSITORY = Symbol('INDICACIONES_REPOSITORY');
