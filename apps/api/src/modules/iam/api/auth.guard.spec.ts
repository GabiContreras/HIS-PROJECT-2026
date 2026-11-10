import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { AuthGuard } from './auth.guard.js';

function contextWith(headers: Record<string, string>) {
  const request: { headers: Record<string, string>; user?: unknown } = {
    headers,
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('AuthGuard', () => {
  const claims = {
    sub: 'user-1',
    sid: 'session-1',
    rol: RolUsuario.MEDICO,
    superadmin: false,
  };
  const identity = {
    accountId: 'user-1',
    sessionId: 'session-1',
    rol: RolUsuario.MEDICO,
    esSuperadmin: false,
  };

  it('rejects a request without Authorization header', async () => {
    const tokens = { verifyAccessToken: vi.fn() };
    const auth = { getSessionIdentity: vi.fn() };
    const guard = new AuthGuard(tokens as never, auth as never);
    const { context } = contextWith({});

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Se requiere un token de acceso.',
    );
    expect(tokens.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('rejects an Authorization header that is not a Bearer token', async () => {
    const tokens = { verifyAccessToken: vi.fn() };
    const auth = { getSessionIdentity: vi.fn() };
    const guard = new AuthGuard(tokens as never, auth as never);
    const { context } = contextWith({ authorization: 'Basic abc' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('does not touch the session when the token is invalid or expired', async () => {
    const tokens = {
      verifyAccessToken: vi.fn(() => {
        throw new UnauthorizedException('Token inválido.');
      }),
    };
    const auth = { getSessionIdentity: vi.fn() };
    const guard = new AuthGuard(tokens as never, auth as never);
    const { context } = contextWith({ authorization: 'Bearer malo' });

    await expect(guard.canActivate(context)).rejects.toThrow('Token inválido.');
    expect(auth.getSessionIdentity).not.toHaveBeenCalled();
  });

  it('rejects when the session behind a valid token was revoked', async () => {
    const tokens = { verifyAccessToken: vi.fn().mockReturnValue(claims) };
    const auth = {
      getSessionIdentity: vi
        .fn()
        .mockRejectedValue(new UnauthorizedException('La sesión no está activa.')),
    };
    const guard = new AuthGuard(tokens as never, auth as never);
    const { context } = contextWith({ authorization: 'Bearer bueno' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      'La sesión no está activa.',
    );
  });

  it('lets the request through and attaches the session identity', async () => {
    const tokens = { verifyAccessToken: vi.fn().mockReturnValue(claims) };
    const auth = { getSessionIdentity: vi.fn().mockResolvedValue(identity) };
    const guard = new AuthGuard(tokens as never, auth as never);
    const { context, request } = contextWith({
      authorization: 'Bearer bueno',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(tokens.verifyAccessToken).toHaveBeenCalledWith('bueno');
    expect(request.user).toEqual(identity);
  });
});
