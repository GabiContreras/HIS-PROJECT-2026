import { EstadoCuenta, RolUsuario, Usuario } from '../../../entities/usuario.entity.js';
import type { SessionIdentity } from '../application/auth.service.js';
import { AccountAdminService } from './account-admin.service.js';

const superadmin: SessionIdentity = {
  accountId: 'root-1',
  sessionId: 's-root',
  rol: RolUsuario.ADMINISTRATIVO,
  esSuperadmin: true,
};
const admin: SessionIdentity = {
  accountId: 'admin-1',
  sessionId: 's-admin',
  rol: RolUsuario.ADMINISTRATIVO,
  esSuperadmin: false,
};

function account(overrides: Partial<Usuario>): Usuario {
  return {
    id: 'target-1',
    nombre: 'Ada',
    apellido: 'Lovelace',
    email: 'ada@example.com',
    rol: RolUsuario.ENFERMERO,
    estado: EstadoCuenta.ACTIVO,
    emailVerificado: true,
    esSuperadmin: false,
    ...overrides,
  } as Usuario;
}

function build(target: Usuario | null) {
  const usuarios = {
    findOneBy: vi.fn().mockResolvedValue(target),
    save: vi.fn(async (value: Usuario) => value),
  };
  const sesiones = { update: vi.fn().mockResolvedValue(undefined) };
  const auth = {
    setTemporaryPassword: vi
      .fn()
      .mockResolvedValue({ message: 'La contraseña temporal fue asignada.' }),
  };
  const service = new AccountAdminService(
    usuarios as never,
    sesiones as never,
    auth as never,
  );
  return { service, usuarios, sesiones, auth };
}

describe('AccountAdminService permissions', () => {
  it('lets a regular administrator deactivate a nurse', async () => {
    const { service, usuarios } = build(account({}));
    const result = await service.deactivate('target-1', admin);
    expect(result.estado).toBe(EstadoCuenta.DESHABILITADO);
    expect(usuarios.save).toHaveBeenCalled();
  });

  it.each([
    ['updateProfile', (s: AccountAdminService) => s.updateProfile('target-1', { nombre: 'Nuevo' }, admin)],
    ['enableDoctor', (s: AccountAdminService) => s.enableDoctor('target-1', admin)],
    ['deactivate', (s: AccountAdminService) => s.deactivate('target-1', admin)],
    ['resetPassword', (s: AccountAdminService) => s.resetPassword('target-1', { passwordTemporal: 'TempPassword4' }, admin)],
  ])(
    'forbids a non-superadmin from running %s on another administrator',
    async (_name, run) => {
      const { service, usuarios, auth } = build(
        account({
          rol: RolUsuario.ADMINISTRATIVO,
          estado: EstadoCuenta.DESHABILITADO,
        }),
      );
      await expect(run(service)).rejects.toThrow(
        'Solo el superadmin puede gestionar cuentas administrativas.',
      );
      expect(usuarios.save).not.toHaveBeenCalled();
      expect(auth.setTemporaryPassword).not.toHaveBeenCalled();
    },
  );

  it('lets the superadmin deactivate another administrator and revokes sessions', async () => {
    const { service, sesiones } = build(
      account({ rol: RolUsuario.ADMINISTRATIVO }),
    );
    const result = await service.deactivate('target-1', superadmin);
    expect(result.estado).toBe(EstadoCuenta.DESHABILITADO);
    expect(sesiones.update).toHaveBeenCalled();
  });

  it('blocks self-deactivation', async () => {
    const { service, usuarios } = build(
      account({ id: 'admin-1', rol: RolUsuario.ADMINISTRATIVO }),
    );
    await expect(service.deactivate('admin-1', admin)).rejects.toThrow(
      'No podés deshabilitar tu propia cuenta.',
    );
    expect(usuarios.save).not.toHaveBeenCalled();
  });

  it('keeps protecting the root superadmin', async () => {
    const { service } = build(
      account({ rol: RolUsuario.ADMINISTRATIVO, esSuperadmin: true }),
    );
    await expect(service.deactivate('target-1', superadmin)).rejects.toThrow(
      'No se puede deshabilitar al superadmin raíz.',
    );
  });
});

describe('AccountAdminService.resetPassword', () => {
  it('assigns a temporary password to a nurse or doctor', async () => {
    const { service, auth } = build(account({ rol: RolUsuario.MEDICO }));
    await expect(
      service.resetPassword('target-1', { passwordTemporal: 'TempPassword4' }, admin),
    ).resolves.toEqual({ message: 'La contraseña temporal fue asignada.' });
    expect(auth.setTemporaryPassword).toHaveBeenCalledWith(
      'target-1',
      'TempPassword4',
    );
  });

  it('refuses to reset the caller own password', async () => {
    const { service, auth } = build(account({ id: 'admin-1' }));
    await expect(
      service.resetPassword('admin-1', { passwordTemporal: 'TempPassword4' }, admin),
    ).rejects.toThrow('cambio de contraseña con tu clave actual');
    expect(auth.setTemporaryPassword).not.toHaveBeenCalled();
  });

  it('refuses to reset the root superadmin', async () => {
    const { service, auth } = build(
      account({ rol: RolUsuario.ADMINISTRATIVO, esSuperadmin: true }),
    );
    await expect(
      service.resetPassword('target-1', { passwordTemporal: 'TempPassword4' }, superadmin),
    ).rejects.toThrow('superadmin raíz');
    expect(auth.setTemporaryPassword).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown account', async () => {
    const { service } = build(null);
    await expect(
      service.resetPassword('missing', { passwordTemporal: 'TempPassword4' }, admin),
    ).rejects.toThrow('No se encontró la cuenta.');
  });
});
