import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from '../../shared/http';
import {
  createLiquidation,
  getLiquidation,
  listLiquidations,
  type Liquidation,
} from '../liquidations';

vi.mock('../../shared/http', () => ({
  http: { get: vi.fn(), post: vi.fn() },
}));

describe('liquidations service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('crea una liquidacion con POST /billing/liquidaciones', async () => {
    const liquidation = { id: 'l1' } as Liquidation;
    vi.mocked(http.post).mockResolvedValue(liquidation);
    const input = { financiadorId: 'f1', desde: '2026-03-01', hasta: '2026-03-31' };

    const result = await createLiquidation(input);

    expect(http.post).toHaveBeenCalledWith('/billing/liquidaciones', input);
    expect(result).toBe(liquidation);
  });

  it('lista sin query cuando no hay filtros', async () => {
    vi.mocked(http.get).mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });

    await listLiquidations();

    expect(http.get).toHaveBeenCalledWith('/billing/liquidaciones');
  });

  it('envia el financiador y la paginacion en la query', async () => {
    vi.mocked(http.get).mockResolvedValue({ items: [], total: 0, limit: 10, offset: 20 });

    await listLiquidations({ financiadorId: 'f1', limit: 10, offset: 20 });

    expect(http.get).toHaveBeenCalledWith('/billing/liquidaciones?financiadorId=f1&limit=10&offset=20');
  });

  it('pide el detalle por id', async () => {
    vi.mocked(http.get).mockResolvedValue({ id: 'l1', cargos: [] });

    await getLiquidation('l1');

    expect(http.get).toHaveBeenCalledWith('/billing/liquidaciones/l1');
  });
});
