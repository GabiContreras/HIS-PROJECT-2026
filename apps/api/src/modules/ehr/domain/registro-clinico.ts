export enum CategoriaRegistro {
  ALERGIA = 'ALERGIA',
  ANTECEDENTE_FAMILIAR = 'ANTECEDENTE_FAMILIAR',
  EVOLUCION = 'EVOLUCION',
  ESTUDIO = 'ESTUDIO',
}

export interface RegistroClinicoView {
  id: string;
  categoria: CategoriaRegistro;
  /** Sustancia, parentesco o tipo de estudio; `null` en las evoluciones. */
  titulo: string | null;
  detalle: string;
  /** "Apellido, Nombre" de quien lo registró. */
  registradoPor: string;
  fechaHora: string;
}

export interface Historia {
  alergias: RegistroClinicoView[];
  antecedentesFamiliares: RegistroClinicoView[];
  evoluciones: RegistroClinicoView[];
  estudios: RegistroClinicoView[];
}

/** Reparte los registros (ya ordenados) en las secciones de la historia clínica, conservando el orden. */
export function armarHistoria(registros: RegistroClinicoView[]): Historia {
  const historia: Historia = { alergias: [], antecedentesFamiliares: [], evoluciones: [], estudios: [] };
  for (const registro of registros) {
    switch (registro.categoria) {
      case CategoriaRegistro.ALERGIA:
        historia.alergias.push(registro);
        break;
      case CategoriaRegistro.ANTECEDENTE_FAMILIAR:
        historia.antecedentesFamiliares.push(registro);
        break;
      case CategoriaRegistro.EVOLUCION:
        historia.evoluciones.push(registro);
        break;
      case CategoriaRegistro.ESTUDIO:
        historia.estudios.push(registro);
        break;
    }
  }
  return historia;
}
