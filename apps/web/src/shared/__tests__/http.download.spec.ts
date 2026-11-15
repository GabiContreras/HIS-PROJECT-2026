import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('http.download', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_API_URL', 'http://api.test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('devuelve el Blob con el BOM intacto y el nombre del header', async () => {
    const cuerpo = new Uint8Array([0xef, 0xbb, 0xbf, 0x69, 0x64]);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(cuerpo, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="cargos-2026-11-15.csv"',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { http, setAccessToken } = await import('../http');
    setAccessToken('token-prueba');

    const { blob, filename } = await http.download('/billing/cargos/exportar');

    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(filename).toBe('cargos-2026-11-15.csv');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/billing/cargos/exportar');
    expect(init.headers.Authorization).toBe('Bearer token-prueba');
  });

  it('devuelve null como nombre si no hay Content-Disposition', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x', { status: 200 })));
    const { http } = await import('../http');

    const { filename } = await http.download('/billing/cargos/exportar');

    expect(filename).toBeNull();
  });

  it('lanza ApiError con el mensaje del servidor cuando responde un error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'No tenés permiso' }), { status: 403 }),
      ),
    );
    const { http, ApiError } = await import('../http');

    const error = await http.download('/billing/cargos/exportar').catch((reason) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(403);
    expect(error.message).toBe('No tenés permiso');
  });
});
