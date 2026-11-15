import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CrearLiquidacionDto, LiquidacionesQueryDto } from './liquidacion.dto.js';

const UUID = '550e8400-e29b-41d4-a716-446655440010';

const errorsOf = async <T extends object>(cls: new () => T, plain: Record<string, unknown>) =>
  validate(plainToInstance(cls, plain));

describe('CrearLiquidacionDto', () => {
  it('acepta un cuerpo valido', async () => {
    expect(
      await errorsOf(CrearLiquidacionDto, { financiadorId: UUID, desde: '2026-03-01', hasta: '2026-03-31' }),
    ).toHaveLength(0);
  });

  it.each([
    ['sin financiadorId', { desde: '2026-03-01', hasta: '2026-03-31' }],
    ['sin desde', { financiadorId: UUID, hasta: '2026-03-31' }],
    ['sin hasta', { financiadorId: UUID, desde: '2026-03-01' }],
    ['financiadorId que no es UUID', { financiadorId: 'abc', desde: '2026-03-01', hasta: '2026-03-31' }],
    ['desde numerico', { financiadorId: UUID, desde: 20260301, hasta: '2026-03-31' }],
    ['cuerpo vacio', {}],
  ])('rechaza %s', async (_nombre, cuerpo) => {
    expect((await errorsOf(CrearLiquidacionDto, cuerpo)).length).toBeGreaterThan(0);
  });
});

describe('LiquidacionesQueryDto', () => {
  it('acepta una consulta vacia y una con todos los campos', async () => {
    expect(await errorsOf(LiquidacionesQueryDto, {})).toHaveLength(0);
    expect(
      await errorsOf(LiquidacionesQueryDto, { financiadorId: UUID, limit: '100', offset: '0' }),
    ).toHaveLength(0);
  });

  it.each([
    { financiadorId: 'abc' },
    { limit: '0' },
    { limit: '101' },
    { limit: 'abc' },
    { limit: '1.5' },
    { offset: '-1' },
    { offset: 'abc' },
  ])('rechaza %j', async (consulta) => {
    expect((await errorsOf(LiquidacionesQueryDto, consulta)).length).toBeGreaterThan(0);
  });
});
