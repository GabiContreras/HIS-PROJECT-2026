const API_URL: string = import.meta.env.VITE_API_URL;
if (!API_URL) throw new Error('Falta VITE_API_URL en apps/web/.env');

export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
interface RequestOptions {
  method?: Method;
  body?: unknown;
  responseType?: 'blob';
  signal?: AbortSignal;
  accept?: string;
}

export interface Download {
  blob: Blob;
  filename: string | null;
}

let accessToken: string | null = null;
let refreshSession: (() => Promise<boolean>) | null = null;
let onSessionExpired: (() => void) | null = null;
let refreshing: Promise<boolean> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function configureAuth(handlers: {
  refresh: () => Promise<boolean>;
  onSessionExpired: () => void;
}): void {
  refreshSession = handlers.refresh;
  onSessionExpired = handlers.onSessionExpired;
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.accept) headers['Accept'] = options.accept;
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  try {
    return await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      credentials: path.startsWith('/auth/') ? 'include' : 'same-origin',
      signal: options.signal,
    });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor. Verificá que la API esté en marcha.');
  }
}

function readMessage(data: unknown, status: number): string {
  if (typeof data === 'object' && data !== null && 'message' in data) {
    const message = (data as { message: unknown }).message;
    if (Array.isArray(message)) return message.join('. ');
    if (typeof message === 'string') return message;
  }
  if (status === 401) return 'Tu sesión no es válida. Iniciá sesión de nuevo.';
  if (status === 403) return 'No tenés permiso para hacer esto.';
  if (status >= 500) return 'Error del servidor. Probá de nuevo en unos minutos.';
  return 'No se pudo completar la operación.';
}

function filenameFrom(disposition: string | null): string | null {
  const match = /filename="?([^";]+)"?/i.exec(disposition ?? '');
  return match?.[1] ?? null;
}

async function parse<T>(response: Response, responseType?: 'blob'): Promise<T> {
  if (response.status === 204) return undefined as T;
  if (responseType === 'blob' && response.ok) {
    const blob = await response.blob();
    return { blob, filename: filenameFrom(response.headers.get('Content-Disposition')) } as T;
  }
  const text = await response.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) throw new ApiError(response.status, readMessage(data, response.status), data);
  return data as T;
}

function refreshOnce(): Promise<boolean> {
  if (!refreshSession) return Promise.resolve(false);
  if (!refreshing) {
    refreshing = refreshSession()
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options);

  if (response.status === 401 && !path.startsWith('/auth/')) {
    if (await refreshOnce()) {
      response = await send(path, options);
    } else {
      onSessionExpired?.();
    }
  }
  return parse<T>(response, options.responseType);
}

export async function openStream(path: string, signal: AbortSignal): Promise<Response> {
  const options: RequestOptions = { signal, accept: 'text/event-stream' };
  let response = await send(path, options);

  if (response.status === 401 && !path.startsWith('/auth/')) {
    if (await refreshOnce()) {
      response = await send(path, options);
    } else {
      onSessionExpired?.();
    }
  }
  if (!response.ok) await parse<never>(response);
  return response;
}

export const http = {
  get: <T>(path: string) => request<T>(path),
  download: (path: string) => request<Download>(path, { responseType: 'blob' }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T = void>(path: string) => request<T>(path, { method: 'DELETE' }),
  stream: (path: string, signal: AbortSignal) => openStream(path, signal),
};