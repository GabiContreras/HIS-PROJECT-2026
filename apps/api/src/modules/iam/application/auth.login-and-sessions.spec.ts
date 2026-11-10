import { QueryFailedError } from 'typeorm';
import {
  EstadoCuenta,
  RolUsuario,
  Usuario,
} from '../../../entities/usuario.entity.js';
import { AuthService } from './auth.service.js';

function buildUser(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: 'user-1',
    nombre: 'Ada',
    apellido: 'Lovelace',
    email: 'ada@example.com',
    passwordHash: 'scrypt$stored',
    rol: RolUsuario.ENFERMERO,
    estado: EstadoCuenta.ACTIVO,
    esSuperadmin: false,
    intentosFallidos: 0,
    bloqueadoHasta: null,
    ...overrides,
  } as Usuario;
}

function buildService(options: {
  user?: Usuario | null;
  passwordMatches?: boolean;
  lockedUser?: Usuario | null;
}) {
  const user = options.user === undefined ? buildUser() : options.user;
  const lockedUser =
    options.lockedUser === undefined ? user : options.lockedUser;

  const usersRepo = {
    createQueryBuilder: vi.fn(() => ({
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue(user),
    })),
    save: vi.fn(async (value) => value),
    create: vi.fn((value) => value),
    findOneBy: vi.fn().mockResolvedValue(user),
    findOne: vi.fn().mockResolvedValue(lockedUser),
    update: vi.fn().mockResolvedValue({ affected: 1 }),
  };
  const sessionsRepo = {
    create: vi.fn((value) => value),
    save: vi.fn(async (value) => ({ ...value, id: 'session-1' })),
    update: vi.fn().mockResolvedValue(undefined),
    findOneBy: vi.fn(),
    findOne: vi.fn(),
  };
  const manager = {
    getRepository: vi.fn((entity) =>
      entity === Usuario ? usersRepo : sessionsRepo,
    ),
  };
  const dataSource = {
    transaction: vi.fn((operation) => operation(manager)),
  };
  const hasher = {
    hash: vi.fn().mockResolvedValue('scrypt$new'),
    verify: vi.fn().mockResolvedValue(options.passwordMatches ?? true),
  };
  const tokens = {
    hashOpaqueValue: vi.fn((value: string) => `hash(${value})`),
    createRefreshToken: vi.fn().mockReturnValue('refresh-token'),
    refreshTokenTtlSeconds: 3600,
    issueAccessToken: vi.fn().mockReturnValue('access-token'),
  };
  const service = new AuthService(
    usersRepo as never,
    sessionsRepo as never,
    dataSource as never,
    hasher as never,
    tokens as never,
  );
  return { service, usersRepo, sessionsRepo, hasher, tokens, dataSource };
}

describe('AuthService login', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  it('opens a session and clears failed attempts on valid credentials', async () => {
    const user = buildUser({ intentosFallidos: 3 });
    const { service, usersRepo, sessionsRepo } = buildService({ user });

    const result = await service.login('ADA@example.com ', 'CorrectHorse4');

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(result.account).toMatchObject({
      id: 'user-1',
      rol: RolUsuario.ENFERMERO,
    });
    expect(usersRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ intentosFallidos: 0, bloqueadoHasta: null }),
    );
    expect(sessionsRepo.save).toHaveBeenCalled();
  });

  it('rejects an unknown email with the generic message and still hashes', async () => {
    const { service, hasher } = buildService({ user: null });

    await expect(service.login('nadie@example.com', 'x')).rejects.toThrow(
      'Correo o contraseña incorrectos.',
    );
    expect(hasher.hash).toHaveBeenCalled();
  });

  it('counts a failed attempt when the password is wrong', async () => {
    const locked = buildUser({ intentosFallidos: 1 });
    const { service, usersRepo } = buildService({
      passwordMatches: false,
      lockedUser: locked,
    });

    await expect(service.login('ada@example.com', 'mala')).rejects.toThrow(
      'Correo o contraseña incorrectos.',
    );
    expect(usersRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ intentosFallidos: 2, bloqueadoHasta: null }),
    );
  });

  it('locks the account for 15 minutes on the fifth failed attempt', async () => {
    const locked = buildUser({ intentosFallidos: 4 });
    const { service, usersRepo } = buildService({
      passwordMatches: false,
      lockedUser: locked,
    });
    const before = Date.now();

    await expect(service.login('ada@example.com', 'mala')).rejects.toThrow(
      'Correo o contraseña incorrectos.',
    );

    const saved = usersRepo.save.mock.calls[0][0] as Usuario;
    expect(saved.intentosFallidos).toBe(0);
    expect(saved.bloqueadoHasta).toBeInstanceOf(Date);
    const lockMs = (saved.bloqueadoHasta as Date).getTime() - before;
    expect(lockMs).toBeGreaterThanOrEqual(15 * 60 * 1000 - 1000);
    expect(lockMs).toBeLessThanOrEqual(15 * 60 * 1000 + 1000);
  });

  it('rejects a locked account even with the right password', async () => {
    const user = buildUser({
      bloqueadoHasta: new Date(Date.now() + 5 * 60 * 1000),
    });
    const { service, hasher, sessionsRepo } = buildService({ user });

    await expect(service.login('ada@example.com', 'CorrectHorse4')).rejects.toThrow(
      'Correo o contraseña incorrectos.',
    );
    expect(hasher.verify).not.toHaveBeenCalled();
    expect(sessionsRepo.save).not.toHaveBeenCalled();
  });

  it('accepts login again once the lock has expired', async () => {
    const user = buildUser({
      bloqueadoHasta: new Date(Date.now() - 1000),
    });
    const { service } = buildService({ user });

    await expect(
      service.login('ada@example.com', 'CorrectHorse4'),
    ).resolves.toMatchObject({ accessToken: 'access-token' });
  });

  it.each([
    EstadoCuenta.PENDIENTE_HABILITACION,
    EstadoCuenta.DESHABILITADO,
    EstadoCuenta.BAJA,
  ])('does not open a session for an account in state %s', async (estado) => {
    const { service, sessionsRepo } = buildService({
      user: buildUser({ estado }),
    });

    await expect(
      service.login('ada@example.com', 'CorrectHorse4'),
    ).rejects.toThrow('La cuenta no está habilitada para iniciar sesión.');
    expect(sessionsRepo.save).not.toHaveBeenCalled();
  });
});

describe('AuthService account creation', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });

  it('creates an active administrative account that is not superadmin', async () => {
    const { service, usersRepo } = buildService({});

    const account = await service.createAdministrator({
      nombre: ' Grace ',
      apellido: ' Hopper ',
      email: ' Grace@Example.com ',
      password: 'CorrectHorse4',
    });

    expect(usersRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Grace',
        apellido: 'Hopper',
        email: 'grace@example.com',
        rol: RolUsuario.ADMINISTRATIVO,
        estado: EstadoCuenta.ACTIVO,
        esSuperadmin: false,
        passwordHash: 'scrypt$new',
      }),
    );
    expect(account).toMatchObject({ rol: RolUsuario.ADMINISTRATIVO });
  });

  it('rejects an administrator without name or surname', async () => {
    const { service, usersRepo } = buildService({});

    await expect(
      service.createAdministrator({
        nombre: '  ',
        apellido: 'Hopper',
        email: 'grace@example.com',
        password: 'CorrectHorse4',
      }),
    ).rejects.toThrow('Nombre y apellido son obligatorios.');
    expect(usersRepo.save).not.toHaveBeenCalled();
  });

  it('answers 409 when the email is already registered', async () => {
    const { service, usersRepo } = buildService({});
    usersRepo.save.mockRejectedValueOnce(
      new QueryFailedError('INSERT', [], { code: '23505' } as never),
    );

    await expect(
      service.register({
        nombre: 'Ada',
        apellido: 'Lovelace',
        email: 'ada@example.com',
        rol: RolUsuario.ENFERMERO,
        password: 'CorrectHorse4',
      }),
    ).rejects.toThrow('Ya existe una cuenta con ese correo.');
  });

  it('rejects a registration without name or surname', async () => {
    const { service, usersRepo } = buildService({});

    await expect(
      service.register({
        nombre: '',
        apellido: 'Lovelace',
        email: 'ada@example.com',
        rol: RolUsuario.ENFERMERO,
        password: 'CorrectHorse4',
      }),
    ).rejects.toThrow('Nombre y apellido son obligatorios.');
    expect(usersRepo.save).not.toHaveBeenCalled();
  });
});

describe('AuthService password management', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });

  it('refuses to reset the password of an unknown or disabled account', async () => {
    const unknown = buildService({ user: null });
    await expect(
      unknown.service.resetPassword({
        email: 'x@example.com',
        password: 'NewSecurePassword4',
      }),
    ).rejects.toThrow('No se encontró una cuenta habilitada.');

    const disabled = buildService({
      user: buildUser({ estado: EstadoCuenta.DESHABILITADO }),
    });
    await expect(
      disabled.service.resetPassword({
        email: 'ada@example.com',
        password: 'NewSecurePassword4',
      }),
    ).rejects.toThrow('No se encontró una cuenta habilitada.');
    expect(disabled.usersRepo.update).not.toHaveBeenCalled();
  });

  it('activates a non-doctor account that was pending verification', async () => {
    const { service, usersRepo } = buildService({
      user: buildUser({ estado: EstadoCuenta.PENDIENTE_VERIFICACION }),
    });

    await service.resetPassword({
      email: 'ada@example.com',
      password: 'NewSecurePassword4',
    });

    expect(usersRepo.update).toHaveBeenCalledWith(
      { id: 'user-1' },
      expect.objectContaining({ estado: EstadoCuenta.ACTIVO }),
    );
  });

  it('rejects a password change when the current password is wrong', async () => {
    const { service, dataSource } = buildService({ passwordMatches: false });

    await expect(
      service.changePassword(
        {
          accountId: 'user-1',
          sessionId: 'session-1',
          rol: RolUsuario.ENFERMERO,
          esSuperadmin: false,
        },
        'incorrecta',
        'NewSecurePassword4',
      ),
    ).rejects.toThrow('La contraseña actual no es correcta.');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('changes the password inside a transaction and revokes the other sessions', async () => {
    const { service, usersRepo, dataSource } = buildService({});
    const execute = vi.fn().mockResolvedValue(undefined);
    const builder = {
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      execute,
    };
    dataSource.transaction.mockImplementationOnce((operation) =>
      operation({
        getRepository: (entity: unknown) =>
          entity === Usuario
            ? usersRepo
            : { createQueryBuilder: () => builder },
      }),
    );

    await expect(
      service.changePassword(
        {
          accountId: 'user-1',
          sessionId: 'session-1',
          rol: RolUsuario.ENFERMERO,
          esSuperadmin: false,
        },
        'CorrectHorse4',
        'NewSecurePassword4',
      ),
    ).resolves.toEqual({ message: 'La contraseña fue actualizada.' });

    expect(usersRepo.update).toHaveBeenCalledWith(
      { id: 'user-1' },
      { passwordHash: 'scrypt$new' },
    );
    expect(builder.andWhere).toHaveBeenCalledWith('"id" != :sessionId', {
      sessionId: 'session-1',
    });
    expect(execute).toHaveBeenCalled();
  });

  it('keeps forgot-password disabled and does not reveal accounts', async () => {
    const { service, usersRepo } = buildService({});

    const result = await service.forgotPassword('ada@example.com');

    expect(result.message).toContain('temporalmente deshabilitada');
    expect(usersRepo.createQueryBuilder).not.toHaveBeenCalled();
  });
});

describe('AuthService sessions', () => {
  it('logout revokes the session of the given refresh token', async () => {
    const { service, sessionsRepo } = buildService({});

    await service.logout('refresh-token');

    expect(sessionsRepo.update).toHaveBeenCalledWith(
      { tokenHash: 'hash(refresh-token)' },
      { revocadoEn: expect.any(Date) },
    );
  });

  it('logout without a token does nothing', async () => {
    const { service, sessionsRepo } = buildService({});

    await service.logout(undefined);

    expect(sessionsRepo.update).not.toHaveBeenCalled();
  });

  it('refresh rejects an unknown token', async () => {
    const { service, sessionsRepo } = buildService({});
    sessionsRepo.findOne.mockResolvedValue(null);

    await expect(service.refresh('desconocido')).rejects.toThrow(
      'La sesión venció o fue revocada.',
    );
  });

  it('refresh revokes and rejects an expired session', async () => {
    const { service, sessionsRepo } = buildService({});
    const expired = {
      id: 'session-1',
      familiaId: 'family-1',
      usuarioId: 'user-1',
      expiraEn: new Date(Date.now() - 1000),
      revocadoEn: null,
    };
    sessionsRepo.findOne.mockResolvedValue(expired);

    await expect(service.refresh('viejo')).rejects.toThrow(
      'La sesión venció o fue revocada.',
    );
    expect(sessionsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ revocadoEn: expect.any(Date) }),
    );
  });

  it('refresh revokes the family when the account is no longer active', async () => {
    const { service, sessionsRepo, usersRepo } = buildService({});
    sessionsRepo.findOne.mockResolvedValue({
      id: 'session-1',
      familiaId: 'family-1',
      usuarioId: 'user-1',
      expiraEn: new Date(Date.now() + 60_000),
      revocadoEn: null,
    });
    usersRepo.findOne.mockResolvedValue(
      buildUser({ estado: EstadoCuenta.DESHABILITADO }),
    );

    await expect(service.refresh('token')).rejects.toThrow(
      'La sesión venció o fue revocada.',
    );
    expect(sessionsRepo.update).toHaveBeenCalledWith(
      { familiaId: 'family-1', revocadoEn: expect.anything() },
      { revocadoEn: expect.any(Date) },
    );
  });

  const claims = {
    sub: 'user-1',
    sid: 'session-1',
    rol: RolUsuario.ENFERMERO,
    superadmin: false,
  };
  const activeSession = () => ({
    id: 'session-1',
    usuarioId: 'user-1',
    revocadoEn: null,
    expiraEn: new Date(Date.now() + 60_000),
  });

  it('resolves the identity of an active session', async () => {
    const { service, sessionsRepo } = buildService({});
    sessionsRepo.findOneBy.mockResolvedValue(activeSession());

    await expect(service.getSessionIdentity(claims)).resolves.toEqual({
      accountId: 'user-1',
      sessionId: 'session-1',
      rol: RolUsuario.ENFERMERO,
      esSuperadmin: false,
    });
  });

  it.each([
    ['session revoked', { revocadoEn: new Date() }, {}],
    ['session expired', { expiraEn: new Date(Date.now() - 1000) }, {}],
    ['session of another user', { usuarioId: 'otro' }, {}],
    ['account disabled', {}, { estado: EstadoCuenta.DESHABILITADO }],
    ['role changed since the token was issued', {}, { rol: RolUsuario.MEDICO }],
    ['superadmin flag changed', {}, { esSuperadmin: true }],
  ])('rejects the identity when %s', async (_name, sessionPatch, userPatch) => {
    const { service, sessionsRepo, usersRepo } = buildService({});
    sessionsRepo.findOneBy.mockResolvedValue({
      ...activeSession(),
      ...sessionPatch,
    });
    usersRepo.findOneBy.mockResolvedValue(buildUser(userPatch));

    await expect(service.getSessionIdentity(claims)).rejects.toThrow(
      'La sesión no está activa.',
    );
  });

  it('rejects the identity when the session does not exist', async () => {
    const { service, sessionsRepo } = buildService({});
    sessionsRepo.findOneBy.mockResolvedValue(null);

    await expect(service.getSessionIdentity(claims)).rejects.toThrow(
      'La sesión no está activa.',
    );
  });

  it('publicAccount returns the account or 404', async () => {
    const found = buildService({});
    await expect(found.service.publicAccount('user-1')).resolves.toMatchObject({
      id: 'user-1',
      email: 'ada@example.com',
    });

    const missing = buildService({ user: null });
    await expect(missing.service.publicAccount('nadie')).rejects.toThrow(
      'No se encontró la cuenta.',
    );
  });
});
