import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('http.stream', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_API_URL', 'http://api.test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('abre el stream con el token, el Accept de SSE y la señal de cancelación', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('data: 1\n\n', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { http, setAccessToken } = await import('../http');
    setAccessToken('token-prueba');
    const controller = new AbortController();

    const response = await http.stream('/camas/eventos', controller.signal);

    expect(response.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/camas/eventos');
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer token-prueba');
    expect(init.headers.Accept).toBe('text/event-stream');
    expect(init.signal).toBe(controller.signal);
  });

  it('renueva la sesión y reintenta una vez cuando responde 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response('data: 1\n\n', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { http, configureAuth, setAccessToken } = await import('../http');
    const refresh = vi.fn().mockImplementation(async () => {
      setAccessToken('token-nuevo');
      return true;
    });
    configureAuth({ refresh, onSessionExpired: vi.fn() });
    setAccessToken('token-viejo');

    const response = await http.stream('/camas/eventos', new AbortController().signal);

    expect(response.ok).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer token-nuevo');
  });

  it('avisa que la sesión expiró y lanza ApiError si no se pudo renovar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    const { http, configureAuth, ApiError } = await import('../http');
    const onSessionExpired = vi.fn();
    configureAuth({ refresh: async () => false, onSessionExpired });

    const error = await http.stream('/camas/eventos', new AbortController().signal).catch((reason) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(401);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('lanza ApiError con el mensaje del servidor ante un error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Tu rol no permite esta operación' }), { status: 403 })),
    );
    const { http, ApiError } = await import('../http');

    const error = await http.stream('/camas/eventos', new AbortController().signal).catch((reason) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(403);
    expect(error.message).toBe('Tu rol no permite esta operación');
  });

  it('no cambia las demás peticiones: sin Accept ni señal', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { http } = await import('../http');

    await http.get('/camas');

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Accept).toBeUndefined();
    expect(init.signal).toBeUndefined();
  });
});
