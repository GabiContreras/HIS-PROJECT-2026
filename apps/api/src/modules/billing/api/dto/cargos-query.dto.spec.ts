import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CargosFiltroQueryDto, CargosListadoQueryDto } from './cargos-query.dto.js';

const UUID = '550e8400-e29b-41d4-a716-446655440001';

async function propiedadesInvalidas<T extends object>(
  clase: new () => T,
  plano: Record<string, unknown>,
): Promise<string[]> {
  const errores = await validate(plainToInstance(clase, plano));
  return errores.map((error) => error.property);
}

describe('CargosListadoQueryDto', () => {
  it('acepta una query vacia', async () => {
    expect(await propiedadesInvalidas(CargosListadoQueryDto, {})).toEqual([]);
  });

  it.each(['1', '50', '100'])('acepta limit %s', async (limit) => {
    expect(await propiedadesInvalidas(CargosListadoQueryDto, { limit })).toEqual([]);
  });

  it.each(['0', '-1', '101', '1.5', 'abc', ''])('rechaza limit %j', async (limit) => {
    expect(await propiedadesInvalidas(CargosListadoQueryDto, { limit })).toEqual(['limit']);
  });

  it.each(['0', '1', '5000'])('acepta offset %s', async (offset) => {
    expect(await propiedadesInvalidas(CargosListadoQueryDto, { offset })).toEqual([]);
  });

  it.each(['-1', '1.5', 'abc'])('rechaza offset %j', async (offset) => {
    expect(await propiedadesInvalidas(CargosListadoQueryDto, { offset })).toEqual(['offset']);
  });

  it('convierte limit y offset a numero', () => {
    const dto = plainToInstance(CargosListadoQueryDto, { limit: '25', offset: '10' });

    expect(dto.limit).toBe(25);
    expect(dto.offset).toBe(10);
  });
});

describe('CargosFiltroQueryDto', () => {
  it('acepta todos los filtros validos', async () => {
    expect(
      await propiedadesInvalidas(CargosFiltroQueryDto, {
        desde: '2026-03-01',
        hasta: '2026-03-31',
        pacienteId: UUID,
        estado: 'PAGADO',
        tipoAtencion: 'FARMACIA',
      }),
    ).toEqual([]);
  });

  it.each(['PENDIENTE', 'FACTURADO', 'PAGADO', 'ANULADO'])('acepta estado %s', async (estado) => {
    expect(await propiedadesInvalidas(CargosFiltroQueryDto, { estado })).toEqual([]);
  });

  it.each(['REGULAR', 'URGENCIA', 'FARMACIA', 'INTERNACION'])(
    'acepta tipoAtencion %s',
    async (tipoAtencion) => {
      expect(await propiedadesInvalidas(CargosFiltroQueryDto, { tipoAtencion })).toEqual([]);
    },
  );

  it('rechaza estado y tipoAtencion desconocidos', async () => {
    expect(await propiedadesInvalidas(CargosFiltroQueryDto, { estado: 'pagado' })).toEqual(['estado']);
    expect(await propiedadesInvalidas(CargosFiltroQueryDto, { tipoAtencion: 'OTRO' })).toEqual([
      'tipoAtencion',
    ]);
  });

  it('rechaza un pacienteId que no es UUID', async () => {
    expect(await propiedadesInvalidas(CargosFiltroQueryDto, { pacienteId: '123' })).toEqual([
      'pacienteId',
    ]);
  });

  it('rechaza desde y hasta que no son texto', async () => {
    expect(await propiedadesInvalidas(CargosFiltroQueryDto, { desde: ['a', 'b'] })).toEqual(['desde']);
    expect(await propiedadesInvalidas(CargosFiltroQueryDto, { hasta: 5 })).toEqual(['hasta']);
  });
});
