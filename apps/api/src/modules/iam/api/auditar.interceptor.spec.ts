import { UnauthorizedException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import { AuditarInterceptor } from './auditar.interceptor.js';

function build(metadata: unknown, request: Record<string, unknown>) {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(metadata),
    get: vi.fn().mockReturnValue(undefined),
  } as unknown as Reflector;
  const auditoria = { registrar: vi.fn().mockResolvedValue(undefined) };
  const interceptor = new AuditarInterceptor(reflector, auditoria as never);
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
  return { interceptor, auditoria, context };
}

const baseRequest = {
  method: 'POST',
  path: '/auth/login',
  ip: '10.0.0.1',
  params: {},
  body: { email: 'ada@example.com' },
};

describe('AuditarInterceptor', () => {
  it('no registra nada si la ruta no tiene @Auditar', async () => {
    const { interceptor, auditoria, context } = build(undefined, baseRequest);

    await lastValueFrom(interceptor.intercept(context, { handle: () => of('ok') }));

    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('registra la acción con usuario y paciente cuando sale bien', async () => {
    const { interceptor, auditoria, context } = build(
      { accion: 'MODIFICAR_PACIENTE', recurso: 'pacientes', pacienteParam: 'id' },
      {
        ...baseRequest,
        method: 'PATCH',
        path: '/pacientes/p-1',
        params: { id: 'p-1' },
        user: { accountId: 'u-1' },
      },
    );

    await lastValueFrom(interceptor.intercept(context, { handle: () => of({}) }));

    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: 'u-1',
        accion: 'MODIFICAR_PACIENTE',
        pacienteId: 'p-1',
        estadoHttp: 200,
        ip: '10.0.0.1',
      }),
    );
  });

  it('toma el usuario de la respuesta en un login correcto', async () => {
    const { interceptor, auditoria, context } = build(
      { accion: 'LOGIN', recurso: 'auth' },
      baseRequest,
    );

    await lastValueFrom(
      interceptor.intercept(context, {
        handle: () => of({ accessToken: 't', account: { id: 'u-9' } }),
      }),
    );

    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: 'u-9', accion: 'LOGIN', estadoHttp: 201 }),
    );
  });

  it('registra el login fallido con el correo y relanza el error', async () => {
    const { interceptor, auditoria, context } = build(
      { accion: 'LOGIN', recurso: 'auth' },
      baseRequest,
    );

    await expect(
      lastValueFrom(
        interceptor.intercept(context, {
          handle: () => throwError(() => new UnauthorizedException('mal')),
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: null,
        accion: 'LOGIN_FALLIDO',
        estadoHttp: 401,
        detalle: 'ada@example.com',
      }),
    );
  });
});