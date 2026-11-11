export enum CategoriaRegistro {
  ALERGIA = 'ALERGIA',
  ANTECEDENTE_FAMILIAR = 'ANTECEDENTE_FAMILIAR',
  EVOLUCION = 'EVOLUCION',
  ESTUDIO = 'ESTUDIO',
  NOTA_ENFERMERIA = 'NOTA_ENFERMERIA',
}

export interface RegistroClinicoView {
  id: string;
  categoria: CategoriaRegistro;
  titulo: string | null;
  detalle: string;
  registradoPor: string;
  fechaHora: string;
}

export interface Historia {
  alergias: RegistroClinicoView[];
  antecedentesFamiliares: RegistroClinicoView[];
  evoluciones: RegistroClinicoView[];
  estudios: RegistroClinicoView[];
  notasEnfermeria: RegistroClinicoView[];
}

export function armarHistoria(registros: RegistroClinicoView[]): Historia {
  const historia: Historia = { alergias: [], antecedentesFamiliares: [], evoluciones: [], estudios: [], notasEnfermeria: [] };
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
      case CategoriaRegistro.NOTA_ENFERMERIA:
        historia.notasEnfermeria.push(registro);
        break;
    }
  }
  return historia;
}
