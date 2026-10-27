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
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  try {
    return await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      credentials: path.startsWith('/auth/') ? 'include' : 'same-origin',
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

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
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
  return parse<T>(response);
}

export const http = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
};