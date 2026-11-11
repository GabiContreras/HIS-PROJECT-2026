import { describe, expect, it, vi } from 'vitest';
import { BillingService } from './billing.service.js';

function serviceConRows(rows: unknown[]) {
  const qb = {
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    getRawMany: vi.fn().mockResolvedValue(rows),
  };
  const service = Object.create(BillingService.prototype) as BillingService;
  (service as unknown as { cargos: unknown }).cargos = {
    createQueryBuilder: vi.fn().mockReturnValue(qb),
  };
  return { service, qb };
}

describe('BillingService.resumen', () => {
  it('convierte los totales de texto a número y agrupa por cobertura', async () => {
    const { service, qb } = serviceConRows([
      { tipoCobertura: 'MEDICINA_PREPAGA', cantidad: '2', totalPesos: '30000', pacientePesos: '6000', terceroPesos: '24000' },
      { tipoCobertura: 'PARTICULAR', cantidad: '1', totalPesos: '15000', pacientePesos: '15000', terceroPesos: '0' },
    ]);

    const result = await service.resumen();

    expect(qb.groupBy).toHaveBeenCalledWith('c.tipoCobertura');
    expect(result).toEqual([
      { tipoCobertura: 'MEDICINA_PREPAGA', cantidad: 2, totalPesos: 30000, pacientePesos: 6000, terceroPesos: 24000 },
      { tipoCobertura: 'PARTICULAR', cantidad: 1, totalPesos: 15000, pacientePesos: 15000, terceroPesos: 0 },
    ]);
  });

  it('devuelve lista vacía si no hay cargos', async () => {
    const { service } = serviceConRows([]);
    expect(await service.resumen()).toEqual([]);
  });
});