import { CategoriaRegistro, armarHistoria, type RegistroClinicoView } from './registro-clinico.js';

function registro(id: string, categoria: CategoriaRegistro): RegistroClinicoView {
  return { id, categoria, titulo: null, detalle: 'detalle', registradoPor: 'Silva, Ana', fechaHora: '2030-01-01T10:00:00.000Z' };
}

describe('armarHistoria', () => {
  it('reparte los registros por categoría conservando el orden recibido', () => {
    const historia = armarHistoria([
      registro('e2', CategoriaRegistro.EVOLUCION),
      registro('a1', CategoriaRegistro.ALERGIA),
      registro('e1', CategoriaRegistro.EVOLUCION),
      registro('s1', CategoriaRegistro.ESTUDIO),
      registro('f1', CategoriaRegistro.ANTECEDENTE_FAMILIAR),
    ]);

    expect(historia.evoluciones.map((r) => r.id)).toEqual(['e2', 'e1']);
    expect(historia.alergias.map((r) => r.id)).toEqual(['a1']);
    expect(historia.estudios.map((r) => r.id)).toEqual(['s1']);
    expect(historia.antecedentesFamiliares.map((r) => r.id)).toEqual(['f1']);
  });

  it('devuelve las cuatro secciones vacías si no hay registros', () => {
    expect(armarHistoria([])).toEqual({ alergias: [], antecedentesFamiliares: [], evoluciones: [], estudios: [] });
  });
});
