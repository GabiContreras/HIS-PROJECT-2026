import {
  EstadoCuenta,
  RolUsuario,
  Usuario,
} from '../../../entities/usuario.entity.js';
import { AuthService } from './auth.service.js';

describe('AuthService staff account creation', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });

  it.each([
    [RolUsuario.ENFERMERO, EstadoCuenta.ACTIVO],
    [RolUsuario.MEDICO, EstadoCuenta.PENDIENTE_HABILITACION],
  ])('creates a %s account without email verification', async (role, state) => {
    const users = {
      create: vi.fn((value) => value),
      save: vi.fn(async (value) => value),
    };
    const hasher = { hash: vi.fn().mockResolvedValue('scrypt$hash') };
    const service = new AuthService(
      users as never,
      {} as never,
      {} as never,
      hasher as never,
      {} as never,
    );

    const result = await service.createStaff({
      nombre: 'Ada',
      apellido: 'Lovelace',
      email: 'ada@example.com',
      rol: role,
      password: 'CorrectHorse4',
    });

    expect(result.message).toContain('cuenta fue creada');
    expect(users.save).toHaveBeenCalledWith(
      expect.objectContaining({
        emailVerificado: true,
        estado: state,
        passwordHash: 'scrypt$hash',
      }),
    );
  });

  it.each(['development', 'production'])(
    'creates staff accounts regardless of NODE_ENV (%s) because the route is guarded',
    async (env) => {
      process.env.NODE_ENV = env;
      const users = {
        create: vi.fn((value) => value),
        save: vi.fn(async (value) => value),
      };
      const hasher = { hash: vi.fn().mockResolvedValue('scrypt$hash') };
      const service = new AuthService(
        users as never,
        {} as never,
        {} as never,
        hasher as never,
        {} as never,
      );

      await service.createStaff({
        nombre: 'Ada',
        apellido: 'Lovelace',
        email: 'ada@example.com',
        rol: RolUsuario.ENFERMERO,
        password: 'CorrectHorse4',
      });

      expect(users.save).toHaveBeenCalled();
    },
  );

  it('sets a temporary password, clears lockout and revokes every session', async () => {
    const users = { update: vi.fn().mockResolvedValue({ affected: 1 }) };
    const sessions = { update: vi.fn().mockResolvedValue(undefined) };
    const manager = {
      getRepository: vi.fn((entity) => (entity === Usuario ? users : sessions)),
    };
    const dataSource = {
      transaction: vi.fn((operation) => operation(manager)),
    };
    const hasher = { hash: vi.fn().mockResolvedValue('scrypt$new-hash') };
    const service = new AuthService(
      {} as never,
      sessions as never,
      dataSource as never,
      hasher as never,
      {} as never,
    );

    await expect(
      service.setTemporaryPassword('user-1', 'TempPassword4'),
    ).resolves.toEqual({ message: 'La contraseña temporal fue asignada.' });

    expect(users.update).toHaveBeenCalledWith(
      { id: 'user-1' },
      { passwordHash: 'scrypt$new-hash', intentosFallidos: 0, bloqueadoHasta: null },
    );
    expect(sessions.update).toHaveBeenCalledWith(
      { usuarioId: 'user-1', revocadoEn: expect.anything() },
      { revocadoEn: expect.any(Date) },
    );
  });

  it('fails with 404 when the account to reset does not exist', async () => {
    const users = { update: vi.fn().mockResolvedValue({ affected: 0 }) };
    const sessions = { update: vi.fn().mockResolvedValue(undefined) };
    const manager = {
      getRepository: vi.fn((entity) => (entity === Usuario ? users : sessions)),
    };
    const dataSource = {
      transaction: vi.fn((operation) => operation(manager)),
    };
    const service = new AuthService(
      {} as never,
      sessions as never,
      dataSource as never,
      { hash: vi.fn().mockResolvedValue('scrypt$x') } as never,
      {} as never,
    );

    await expect(
      service.setTemporaryPassword('missing', 'TempPassword4'),
    ).rejects.toThrow('No se encontró la cuenta.');
  });
});
