import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from '../../shared/http';
import {
  CHARGES_PAGE_SIZE,
  downloadCharges,
  exportCharges,
  listCharges,
  listChargesPage,
  saveBlob,
  type Charge,
} from '../charges';

vi.mock('../../shared/http', () => ({
  http: { get: vi.fn(), download: vi.fn() },
}));

const charge = (id: string) => ({ id, importePesos: 100 }) as Charge;

function pageOf(items: Charge[], total: number, limit: number, offset: number) {
  return { items, total, limit, offset };
}

describe('charges service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listChargesPage', () => {
    it('pide /billing/cargos sin query cuando no hay filtros', async () => {
      vi.mocked(http.get).mockResolvedValue(pageOf([], 0, 50, 0));

      const page = await listChargesPage();

      expect(http.get).toHaveBeenCalledWith('/billing/cargos');
      expect(page).toEqual(pageOf([], 0, 50, 0));
    });

    it('envia todos los filtros y la paginacion en la query', async () => {
      vi.mocked(http.get).mockResolvedValue(pageOf([], 0, 10, 20));

      await listChargesPage({
        desde: '2026-03-01',
        hasta: '2026-03-31',
        pacienteId: '550e8400-e29b-41d4-a716-446655440001',
        estado: 'PAGADO',
        tipoAtencion: 'FARMACIA',
        limit: 10,
        offset: 20,
      });

      const url = vi.mocked(http.get).mock.calls[0][0];
      const params = new URL(url, 'http://x').searchParams;
      expect(url.startsWith('/billing/cargos?')).toBe(true);
      expect(Object.fromEntries(params)).toEqual({
        desde: '2026-03-01',
        hasta: '2026-03-31',
        pacienteId: '550e8400-e29b-41d4-a716-446655440001',
        estado: 'PAGADO',
        tipoAtencion: 'FARMACIA',
        limit: '10',
        offset: '20',
      });
    });

    it('omite los filtros indefinidos o vacios y conserva offset 0', async () => {
      vi.mocked(http.get).mockResolvedValue(pageOf([], 0, 50, 0));

      await listChargesPage({ desde: undefined, hasta: '', estado: 'ANULADO', offset: 0 });

      expect(http.get).toHaveBeenCalledWith('/billing/cargos?estado=ANULADO&offset=0');
    });
  });

  describe('listCharges', () => {
    it('devuelve el arreglo plano de una sola pagina', async () => {
      const items = [charge('a'), charge('b')];
      vi.mocked(http.get).mockResolvedValue(pageOf(items, 2, CHARGES_PAGE_SIZE, 0));

      const result = await listCharges();

      expect(result).toEqual(items);
      expect(http.get).toHaveBeenCalledTimes(1);
      expect(http.get).toHaveBeenCalledWith('/billing/cargos?limit=100&offset=0');
    });

    it('recorre todas las paginas con limit 100 hasta completar el total', async () => {
      const todos = Array.from({ length: 250 }, (_, index) => charge(`c${index}`));
      vi.mocked(http.get).mockImplementation(async (url: string) => {
        const params = new URL(url, 'http://x').searchParams;
        const limit = Number(params.get('limit'));
        const offset = Number(params.get('offset'));
        return pageOf(todos.slice(offset, offset + limit), todos.length, limit, offset);
      });

      const result = await listCharges();

      expect(result).toEqual(todos);
      expect(http.get).toHaveBeenCalledTimes(3);
      expect(vi.mocked(http.get).mock.calls.map(([url]) => url)).toEqual([
        '/billing/cargos?limit=100&offset=0',
        '/billing/cargos?limit=100&offset=100',
        '/billing/cargos?limit=100&offset=200',
      ]);
    });

    it('devuelve una lista vacia cuando no hay cargos', async () => {
      vi.mocked(http.get).mockResolvedValue(pageOf([], 0, CHARGES_PAGE_SIZE, 0));

      await expect(listCharges()).resolves.toEqual([]);
      expect(http.get).toHaveBeenCalledTimes(1);
    });

    it('corta si una pagina llega vacia aunque el total no se haya completado', async () => {
      vi.mocked(http.get)
        .mockResolvedValueOnce(pageOf([charge('a')], 5, CHARGES_PAGE_SIZE, 0))
        .mockResolvedValueOnce(pageOf([], 5, CHARGES_PAGE_SIZE, 1));

      await expect(listCharges()).resolves.toEqual([charge('a')]);
      expect(http.get).toHaveBeenCalledTimes(2);
    });

    it('propaga el error de la API', async () => {
      vi.mocked(http.get).mockRejectedValue(new Error('boom'));

      await expect(listCharges()).rejects.toThrow('boom');
    });
  });

  describe('exportCharges', () => {
    const BOM = [0xef, 0xbb, 0xbf];
    const csvBlob = () =>
      new Blob([new Uint8Array(BOM), 'id,fecha\r\n'], { type: 'text/csv; charset=utf-8' });

    it('devuelve el Blob con los primeros bytes EF BB BF', async () => {
      vi.mocked(http.download).mockResolvedValue({ blob: csvBlob(), filename: 'cargos-2026-11-15.csv' });

      const blob = await exportCharges({ estado: 'PENDIENTE', tipoAtencion: 'URGENCIA' });

      const bytes = new Uint8Array(await blob.arrayBuffer());
      expect([...bytes.subarray(0, 3)]).toEqual(BOM);
      expect(blob.type).toBe('text/csv; charset=utf-8');
      expect(http.download).toHaveBeenCalledWith(
        '/billing/cargos/exportar?estado=PENDIENTE&tipoAtencion=URGENCIA',
      );
    });

    it('pide /billing/cargos/exportar sin query cuando no hay filtros', async () => {
      vi.mocked(http.download).mockResolvedValue({ blob: csvBlob(), filename: null });

      await exportCharges();

      expect(http.download).toHaveBeenCalledWith('/billing/cargos/exportar');
    });
  });

  describe('descarga', () => {
    const link = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    const createObjectURL = vi.fn(() => 'blob:cargos');
    const revokeObjectURL = vi.fn();

    beforeEach(() => {
      link.href = '';
      link.download = '';
      vi.stubGlobal('document', {
        createElement: vi.fn(() => link),
        body: { appendChild: vi.fn() },
      });
      vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('saveBlob dispara el enlace con el nombre indicado y libera la URL', () => {
      const blob = new Blob(['x']);

      saveBlob(blob, 'cargos-2026-11-15.csv');

      expect(createObjectURL).toHaveBeenCalledWith(blob);
      expect(link.href).toBe('blob:cargos');
      expect(link.download).toBe('cargos-2026-11-15.csv');
      expect(link.click).toHaveBeenCalledOnce();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:cargos');
    });

    it('saveBlob libera la URL aunque el click falle', () => {
      link.click.mockImplementationOnce(() => {
        throw new Error('bloqueado');
      });

      expect(() => saveBlob(new Blob(['x']), 'a.csv')).toThrow('bloqueado');
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:cargos');
    });

    it('downloadCharges usa el nombre del header Content-Disposition', async () => {
      const blob = new Blob(['x'], { type: 'text/csv' });
      vi.mocked(http.download).mockResolvedValue({ blob, filename: 'cargos-2026-11-15.csv' });

      await downloadCharges({ estado: 'PAGADO' });

      expect(http.download).toHaveBeenCalledWith('/billing/cargos/exportar?estado=PAGADO');
      expect(link.download).toBe('cargos-2026-11-15.csv');
      expect(createObjectURL).toHaveBeenCalledWith(blob);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:cargos');
    });

    it('downloadCharges usa cargos.csv si el servidor no informa el nombre', async () => {
      vi.mocked(http.download).mockResolvedValue({ blob: new Blob(['x']), filename: null });

      await downloadCharges();

      expect(link.download).toBe('cargos.csv');
    });

    it('downloadCharges propaga el error y no crea ninguna URL', async () => {
      createObjectURL.mockClear();
      vi.mocked(http.download).mockRejectedValue(new Error('403'));

      await expect(downloadCharges()).rejects.toThrow('403');
      expect(createObjectURL).not.toHaveBeenCalled();
    });
  });
});
