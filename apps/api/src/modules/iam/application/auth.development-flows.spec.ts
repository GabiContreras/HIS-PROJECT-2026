import {
  EstadoCuenta,
  RolUsuario,
  Usuario,
} from '../../../entities/usuario.entity.js';
import { AuthService } from './auth.service.js';

describe('AuthService development account flows', () => {
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

    const result = await service.register({
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

  it('resets an existing password without a verification code and revokes sessions', async () => {
    const account = {
      id: 'user-1',
      email: 'ada@example.com',
      rol: RolUsuario.MEDICO,
      estado: EstadoCuenta.PENDIENTE_HABILITACION,
    } as Usuario;
    const users = {
      createQueryBuilder: vi.fn(() => ({
        where: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(account),
      })),
      update: vi.fn().mockResolvedValue({ affected: 1 }),
    };
    const sessions = { update: vi.fn().mockResolvedValue(undefined) };
    const manager = {
      getRepository: vi.fn((entity) => (entity === Usuario ? users : sessions)),
    };
    const dataSource = {
      transaction: vi.fn((operation) => operation(manager)),
    };
    const hasher = { hash: vi.fn().mockResolvedValue('scrypt$new-hash') };
    const service = new AuthService(
      users as never,
      sessions as never,
      dataSource as never,
      hasher as never,
      {} as never,
    );

    await expect(
      service.resetPassword({
        email: 'ada@example.com',
        password: 'NewSecurePassword4',
      }),
    ).resolves.toEqual({ message: 'La contraseña fue restablecida.' });

    expect(users.update).toHaveBeenCalledWith(
      { id: 'user-1' },
      expect.objectContaining({
        passwordHash: 'scrypt$new-hash',
        estado: EstadoCuenta.PENDIENTE_HABILITACION,
        emailVerificado: true,
      }),
    );
    expect(sessions.update).toHaveBeenCalledWith(
      { usuarioId: 'user-1', revocadoEn: expect.anything() },
      { revocadoEn: expect.any(Date) },
    );
  });

  it('does not allow unverified password reset in production', async () => {
    process.env.NODE_ENV = 'production';
    const users = { createQueryBuilder: vi.fn() };
    const service = new AuthService(
      users as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.resetPassword({
        email: 'ada@example.com',
        password: 'NewSecurePassword4',
      }),
    ).rejects.toThrow('solo está habilitado durante el desarrollo');
    expect(users.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('does not allow registration without email verification in production', async () => {
    process.env.NODE_ENV = 'production';
    const users = { create: vi.fn(), save: vi.fn() };
    const service = new AuthService(
      users as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.register({
        nombre: 'Ada',
        apellido: 'Lovelace',
        email: 'ada@example.com',
        rol: RolUsuario.ENFERMERO,
        password: 'CorrectHorse4',
      }),
    ).rejects.toThrow('solo está habilitada durante el desarrollo');
    expect(users.save).not.toHaveBeenCalled();
  });
});
