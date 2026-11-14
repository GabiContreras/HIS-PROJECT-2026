import type { Patient, TipoCobertura } from '../../services/patients';

export interface CoberturaOpcion {
  tipo: TipoCobertura;
  titulo: string;
  descripcion: string;
  /** Texto del campo de entidad; undefined si ese tipo no pide entidad. */
  entidadLabel?: string;
  entidadObligatoria: boolean;
}

/** Las tres coberturas de la HU de Facturación, con lo que implica cada una al cobrar. */
export const COBERTURAS: CoberturaOpcion[] = [
  {
    tipo: 'OBRA_SOCIAL_PUBLICA',
    titulo: 'Obra social pública',
    descripcion: 'Cubre el 100% de la atención: el paciente no abona nada.',
    entidadLabel: 'Obra social',
    entidadObligatoria: false,
  },
  {
    tipo: 'MEDICINA_PREPAGA',
    titulo: 'Medicina prepaga',
    descripcion: 'El paciente abona un copago fijo y el resto se le reclama a la prepaga.',
    entidadLabel: 'Medicina prepaga',
    entidadObligatoria: true,
  },
  {
    tipo: 'PARTICULAR',
    titulo: 'Particular (sin cobertura)',
    descripcion: 'El paciente abona el 100% del valor de la atención.',
    entidadObligatoria: false,
  },
];

export const COBERTURA_CORTA: Record<TipoCobertura, string> = {
  OBRA_SOCIAL_PUBLICA: 'Obra social pública',
  MEDICINA_PREPAGA: 'Medicina prepaga',
  PARTICULAR: 'Particular',
};

export const opcionDe = (tipo: TipoCobertura | ''): CoberturaOpcion | undefined =>
  COBERTURAS.find((c) => c.tipo === tipo);

/** "Medicina prepaga · Swiss Medical", "Obra social pública", "Particular". */
export function coberturaTexto(patient: Pick<Patient, 'tipoCobertura' | 'entidadCobertura'>): string {
  const base = COBERTURA_CORTA[patient.tipoCobertura];
  return patient.entidadCobertura ? `${base} · ${patient.entidadCobertura}` : base;
}

export interface CoberturaForm {
  tipo: TipoCobertura | '';
  entidad: string;
}

/** Errores por campo; vacío si el formulario es válido. */
export function validarCobertura(form: CoberturaForm): { tipo?: string; entidad?: string } {
  const errors: { tipo?: string; entidad?: string } = {};
  const opcion = opcionDe(form.tipo);
  if (!opcion) errors.tipo = 'Elegí el tipo de cobertura.';
  else if (opcion.entidadObligatoria && !form.entidad.trim()) {
    errors.entidad = `Ingresá el nombre de la ${opcion.entidadLabel?.toLowerCase()}.`;
  }
  return errors;
}
