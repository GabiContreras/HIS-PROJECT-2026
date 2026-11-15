import { EstadoCargo } from './estado-cargo.js';
import {
  armarFiltroCargos,
  LIMITE_MAXIMO,
  LIMITE_POR_DEFECTO,
  OFFSET_POR_DEFECTO,
} from './filtro-cargos.js';
import { PeriodoInvalidoError } from './periodo-reporte.js';
import { TipoAtencionFacturable } from './tipo-atencion-facturable.js';

describe('armarFiltroCargos', () => {
  it('sin filtros deja todo en null', () => {
    expect(armarFiltroCargos({})).toEqual({
      inicio: null,
      finExclusivo: null,
      pacienteId: null,
      estado: null,
      tipoAtencion: null,
    });
  });

  it('combina todos los filtros', () => {
    const filtro = armarFiltroCargos({
      desde: '2026-03-10',
      hasta: '2026-03-12',
      pacienteId: '550e8400-e29b-41d4-a716-446655440001',
      estado: EstadoCargo.PAGADO,
      tipoAtencion: TipoAtencionFacturable.FARMACIA,
    });

    expect(filtro.inicio?.toISOString()).toBe('2026-03-10T03:00:00.000Z');
    expect(filtro.finExclusivo?.toISOString()).toBe('2026-03-13T03:00:00.000Z');
    expect(filtro.pacienteId).toBe('550e8400-e29b-41d4-a716-446655440001');
    expect(filtro.estado).toBe(EstadoCargo.PAGADO);
    expect(filtro.tipoAtencion).toBe(TipoAtencionFacturable.FARMACIA);
  });

  it('acepta solo desde o solo hasta', () => {
    expect(armarFiltroCargos({ desde: '2026-03-10' }).finExclusivo).toBeNull();
    expect(armarFiltroCargos({ hasta: '2026-03-10' }).inicio).toBeNull();
  });

  it('rechaza fechas invalidas y desde posterior a hasta', () => {
    expect(() => armarFiltroCargos({ desde: 'x' })).toThrow(PeriodoInvalidoError);
    expect(() => armarFiltroCargos({ hasta: '2026-02-31' })).toThrow(PeriodoInvalidoError);
    expect(() => armarFiltroCargos({ desde: '2026-03-12', hasta: '2026-03-10' })).toThrow(
      PeriodoInvalidoError,
    );
  });

  it('define el limite por defecto, el maximo y el offset por defecto', () => {
    expect(LIMITE_POR_DEFECTO).toBe(50);
    expect(LIMITE_MAXIMO).toBe(100);
    expect(OFFSET_POR_DEFECTO).toBe(0);
  });
});
