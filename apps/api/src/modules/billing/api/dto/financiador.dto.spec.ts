import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CoverageType } from '../../../../shared/events/coverage-type.js';
import {
  ActualizarFinanciadorDto,
  ActualizarPlanDto,
  CrearFinanciadorDto,
  CrearPlanDto,
} from './financiador.dto.js';

const errorsOf = async <T extends object>(
  cls: new () => T,
  plain: Record<string, unknown>,
) => validate(plainToInstance(cls, plain));

describe('CrearFinanciadorDto', () => {
  it('acepta nombre y tipo validos y recorta espacios', async () => {
    const dto = plainToInstance(CrearFinanciadorDto, {
      nombre: '  OSDE  ',
      tipo: CoverageType.PREPAID,
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.nombre).toBe('OSDE');
  });

  it('rechaza el tipo PARTICULAR', async () => {
    expect(
      await errorsOf(CrearFinanciadorDto, {
        nombre: 'X',
        tipo: CoverageType.SELF_PAY,
      }),
    ).toHaveLength(1);
  });

  it('rechaza un nombre vacio o mas largo que la columna', async () => {
    expect(
      await errorsOf(CrearFinanciadorDto, { nombre: '   ', tipo: CoverageType.PREPAID }),
    ).toHaveLength(1);
    expect(
      await errorsOf(CrearFinanciadorDto, {
        nombre: 'a'.repeat(101),
        tipo: CoverageType.PREPAID,
      }),
    ).toHaveLength(1);
  });
});

describe('ActualizarFinanciadorDto', () => {
  it('acepta un cuerpo parcial', async () => {
    expect(await errorsOf(ActualizarFinanciadorDto, { activo: false })).toHaveLength(0);
  });

  it('rechaza activo que no es booleano y tipo invalido', async () => {
    expect(await errorsOf(ActualizarFinanciadorDto, { activo: 'no' })).toHaveLength(1);
    expect(await errorsOf(ActualizarFinanciadorDto, { tipo: 'OTRO' })).toHaveLength(1);
  });
});

describe('planes', () => {
  it('CrearPlanDto exige nombre', async () => {
    expect(await errorsOf(CrearPlanDto, { nombre: '210' })).toHaveLength(0);
    expect(await errorsOf(CrearPlanDto, {})).toHaveLength(1);
  });

  it('ActualizarPlanDto acepta nombre y activo opcionales', async () => {
    expect(await errorsOf(ActualizarPlanDto, {})).toHaveLength(0);
    expect(await errorsOf(ActualizarPlanDto, { nombre: '', activo: true })).toHaveLength(1);
  });
});
