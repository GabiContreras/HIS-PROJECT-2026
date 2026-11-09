import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useSessionStore } from '../session.store';

vi.mock('../api.ts', () => ({
  authApi: {
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
  },
}));

vi.mock('../../../shared/http.ts', () => ({
  setAccessToken: vi.fn(),
}));

import { authApi } from '../api.ts';
import { setAccessToken } from '../../../shared/http.ts';

const mockAccount = {
  id: '1',
  nombre: 'Juan',
  apellido: 'Perez',
  email: 'juan@test.com',
  rol: 'MEDICO' as const,
  estado: 'ACTIVO' as const,
  esSuperadmin: false,
};

describe('Session Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('debe comenzar sin una sesión iniciada', () => {
    const store = useSessionStore();

    expect(store.account).toBeNull();
    expect(store.isAuthenticated).toBe(false);
    expect(store.role).toBeNull();
    expect(store.fullName).toBe('');
  });

  it('debe guardar los datos al iniciar sesión', async () => {
    const store = useSessionStore();

    vi.mocked(authApi.login).mockResolvedValue({
      accessToken: 'token-123',
      account: mockAccount,
    });

    await store.login('juan@test.com', '123456');

    expect(store.isAuthenticated).toBe(true);
    expect(store.account).toEqual(mockAccount);
    expect(store.role).toBe('MEDICO');
    expect(setAccessToken).toHaveBeenCalledWith('token-123');
  });

  it('debe obtener el nombre completo del usuario', async () => {
    const store = useSessionStore();

    vi.mocked(authApi.login).mockResolvedValue({
      accessToken: 'token-123',
      account: mockAccount,
    });

    await store.login('juan@test.com', '123456');

    expect(store.fullName).toBe('Juan Perez');
  });
    it('debe limpiar la sesión correctamente', () => {
    const store = useSessionStore();

    store.clear();

    expect(store.account).toBeNull();
    expect(store.isAuthenticated).toBe(false);
    expect(setAccessToken).toHaveBeenCalledWith(null);
  });

  it('debe restaurar una sesión correctamente', async () => {
    const store = useSessionStore();

    vi.mocked(authApi.refresh).mockResolvedValue({
      accessToken: 'token-refresh',
      account: mockAccount,
    });

    await store.restore();

    expect(store.isAuthenticated).toBe(true);
    expect(store.restored).toBe(true);
    expect(authApi.refresh).toHaveBeenCalledTimes(1);
  });

  it('no debe restaurar la sesión más de una vez', async () => {
    const store = useSessionStore();

    vi.mocked(authApi.refresh).mockResolvedValue({
      accessToken: 'token-refresh',
      account: mockAccount,
    });

    await store.restore();
    await store.restore();

    expect(authApi.refresh).toHaveBeenCalledTimes(1);
  });

  it('debe limpiar la sesión si falla la restauración', async () => {
    const store = useSessionStore();

    vi.mocked(authApi.refresh).mockRejectedValue(
      new Error('Error de autenticación'),
    );

    await store.restore();

    expect(store.account).toBeNull();
    expect(store.isAuthenticated).toBe(false);
    expect(store.restored).toBe(true);
  });
    it('debe cerrar sesión y limpiar los datos', async () => {
    const store = useSessionStore();

    vi.mocked(authApi.logout).mockResolvedValue(undefined);

    await store.logout();

    expect(authApi.logout).toHaveBeenCalledTimes(1);
    expect(store.account).toBeNull();
    expect(setAccessToken).toHaveBeenCalledWith(null);
  });

  it('debe limpiar los datos aunque falle el logout', async () => {
    const store = useSessionStore();

    vi.mocked(authApi.logout).mockRejectedValue(
      new Error('Error al cerrar sesión'),
    );

    await expect(store.logout()).rejects.toThrow(
      'Error al cerrar sesión',
    );

    expect(store.account).toBeNull();
    expect(setAccessToken).toHaveBeenCalledWith(null);
  });

  it('debe actualizar correctamente una sesión', async () => {
    const store = useSessionStore();

    vi.mocked(authApi.refresh).mockResolvedValue({
      accessToken: 'nuevo-token',
      account: mockAccount,
    });

    const result = await store.refreshSession();

    expect(result).toBe(true);
    expect(store.isAuthenticated).toBe(true);
    expect(setAccessToken).toHaveBeenCalledWith('nuevo-token');
  });
});