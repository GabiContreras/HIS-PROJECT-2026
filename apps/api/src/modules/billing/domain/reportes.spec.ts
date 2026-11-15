import { ordenarPorImporte, sumarImportes } from './reportes.js';

const fila = (nombre: string, totalPesos: number) => ({
  nombre,
  cantidad: 1,
  totalPesos,
  pacientePesos: 0,
  terceroPesos: totalPesos,
});

describe('sumarImportes', () => {
  it('suma cada campo de las filas', () => {
    expect(
      sumarImportes([
        { cantidad: 2, totalPesos: 30000, pacientePesos: 6000, terceroPesos: 24000 },
        { cantidad: 1, totalPesos: 15000, pacientePesos: 15000, terceroPesos: 0 },
      ]),
    ).toEqual({ cantidad: 3, totalPesos: 45000, pacientePesos: 21000, terceroPesos: 24000 });
  });

  it('devuelve ceros sin filas', () => {
    expect(sumarImportes([])).toEqual({
      cantidad: 0,
      totalPesos: 0,
      pacientePesos: 0,
      terceroPesos: 0,
    });
  });
});

describe('ordenarPorImporte', () => {
  it('ordena por importe descendente y desempata por nombre', () => {
    const ordenadas = ordenarPorImporte(
      [fila('Zulema', 100), fila('Ana', 100), fila('Beto', 500)],
      (f) => f.nombre,
    );

    expect(ordenadas.map((f) => f.nombre)).toEqual(['Beto', 'Ana', 'Zulema']);
  });

  it('no modifica el arreglo original', () => {
    const original = [fila('B', 1), fila('A', 2)];

    ordenarPorImporte(original, (f) => f.nombre);

    expect(original.map((f) => f.nombre)).toEqual(['B', 'A']);
  });
});
