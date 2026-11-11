import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import type { SessionIdentity } from '../application/auth.service.js';
import { Roles } from './roles.decorator.js';
import { RolesGuard } from './roles.guard.js';
import { SuperadminGuard } from './superadmin.guard.js';

const identity = (over: Partial<SessionIdentity> = {}): SessionIdentity => ({
  accountId: 'u-1',
  sessionId: 's-1',
  rol: RolUsuario.ENFERMERO,
  esSuperadmin: false,
  ...over,
});

function contexto(user: SessionIdentity, handler: object, clase: object): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => handler,
    getClass: () => clase,
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  class SinRoles {
    abierto() {}
  }
  class ConRolesEnMetodo {
    @Roles(RolUsuario.MEDICO, RolUsuario.ADMINISTRATIVO)
    restringido() {}
  }
  @Roles(RolUsuario.ADMINISTRATIVO)
  class ConRolesEnClase {
    heredado() {}
    @Roles(RolUsuario.ENFERMERO)
    propio() {}
    @Roles()
    listaVacia() {}
  }

  it('deja pasar cuando el endpoint no declara @Roles', () => {
    const ctx = contexto(identity(), SinRoles.prototype.abierto, SinRoles);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it.each([RolUsuario.MEDICO, RolUsuario.ADMINISTRATIVO])('deja pasar a %s cuando su rol está permitido', (rol) => {
    const ctx = contexto(identity({ rol }), ConRolesEnMetodo.prototype.restringido, ConRolesEnMetodo);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('responde 403 cuando el rol no está permitido', () => {
    const ctx = contexto(identity({ rol: RolUsuario.ENFERMERO }), ConRolesEnMetodo.prototype.restringido, ConRolesEnMetodo);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx)).toThrow('Tu rol no permite realizar esta operación.');
  });

  it('usa los roles de la clase cuando el método no declara los suyos', () => {
    const permitido = contexto(identity({ rol: RolUsuario.ADMINISTRATIVO }), ConRolesEnClase.prototype.heredado, ConRolesEnClase);
    const rechazado = contexto(identity({ rol: RolUsuario.MEDICO }), ConRolesEnClase.prototype.heredado, ConRolesEnClase);
    expect(guard.canActivate(permitido)).toBe(true);
    expect(() => guard.canActivate(rechazado)).toThrow(ForbiddenException);
  });

  it('los roles del método reemplazan a los de la clase', () => {
    const enfermero = contexto(identity({ rol: RolUsuario.ENFERMERO }), ConRolesEnClase.prototype.propio, ConRolesEnClase);
    const administrativo = contexto(identity({ rol: RolUsuario.ADMINISTRATIVO }), ConRolesEnClase.prototype.propio, ConRolesEnClase);
    expect(guard.canActivate(enfermero)).toBe(true);
    expect(() => guard.canActivate(administrativo)).toThrow(ForbiddenException);
  });

  it('una lista de roles vacía no restringe', () => {
    const ctx = contexto(identity({ rol: RolUsuario.MEDICO }), ConRolesEnClase.prototype.listaVacia, ConRolesEnClase);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('ser superadmin no saltea la restricción por rol', () => {
    const ctx = contexto(
      identity({ rol: RolUsuario.ADMINISTRATIVO, esSuperadmin: true }),
      ConRolesEnClase.prototype.propio,
      ConRolesEnClase,
    );
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});

describe('SuperadminGuard', () => {
  const guard = new SuperadminGuard();
  const ctx = (user: SessionIdentity) => contexto(user, () => undefined, class {});

  it('deja pasar al superadmin', () => {
    expect(guard.canActivate(ctx(identity({ rol: RolUsuario.ADMINISTRATIVO, esSuperadmin: true })))).toBe(true);
  });

  it.each([RolUsuario.ADMINISTRATIVO, RolUsuario.MEDICO, RolUsuario.ENFERMERO])(
    'responde 403 a un %s que no es superadmin',
    (rol) => {
      expect(() => guard.canActivate(ctx(identity({ rol })))).toThrow(ForbiddenException);
      expect(() => guard.canActivate(ctx(identity({ rol })))).toThrow('Esta operación está reservada al superadmin.');
    },
  );
});
