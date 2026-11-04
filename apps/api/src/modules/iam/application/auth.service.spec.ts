import {
  EstadoCuenta,
  RolUsuario,
  Usuario,
} from '../../../entities/usuario.entity.js';
import { RefreshSession } from '../../../entities/refresh-session.entity.js';
import { AuthService } from './auth.service.js';

describe('AuthService refresh sessions', () => {
  const account = {
    id: 'user-1',
    nombre: 'Ada',
    apellido: 'Lovelace',
    email: 'ada@example.com',
    rol: RolUsuario.MEDICO,
    estado: EstadoCuenta.ACTIVO,
    esSuperadmin: false,
  } as Usuario;

  function setup(session: Partial<RefreshSession>) {
    const oldSession = {
      id: 'session-1',
      usuarioId: account.id,
      familiaId: 'family-1',
      tokenHash: 'hash:old-token',
      expiraEn: new Date(Date.now() + 60_000),
      revocadoEn: null,
      ...session,
    };
    const sessionRepository = {
      findOne: vi.fn().mockResolvedValue(oldSession),
      update: vi.fn().mockResolvedValue(undefined),
      save: vi.fn(async (value) => ({ ...value, id: 'session-2' })),
      create: vi.fn((value) => value),
    };
    const userRepository = {
      findOne: vi.fn().mockResolvedValue(account),
    };
    const manager = {
      getRepository: vi.fn((entity) =>
        entity === RefreshSession ? sessionRepository : userRepository,
      ),
    };
    const dataSource = {
      transaction: vi.fn((operation) => operation(manager)),
    };
    const tokens = {
      hashOpaqueValue: vi.fn((token: string) => `hash:${token}`),
      createRefreshToken: vi.fn(() => 'next-token'),
      refreshTokenTtlSeconds: 604800,
      issueAccessToken: vi.fn(() => 'next-access-token'),
    };
    const service = new AuthService(
      {} as never,
      sessionRepository as never,
      dataSource as never,
      {} as never,
      tokens as never,
    );
    return { service, sessionRepository, tokens, oldSession };
  }

  it('revokes the old token and persists a new token in the same family', async () => {
    const { service, sessionRepository, tokens, oldSession } = setup({});

    const result = await service.refresh('old-token');

    expect(result).toMatchObject({
      accessToken: 'next-access-token',
      refreshToken: 'next-token',
      account: { id: 'user-1', rol: RolUsuario.MEDICO },
    });
    expect(oldSession.revocadoEn).toBeInstanceOf(Date);
    expect(sessionRepository.save).toHaveBeenCalledTimes(2);
    expect(sessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: account.id,
        familiaId: 'family-1',
        tokenHash: 'hash:next-token',
      }),
    );
    expect(tokens.createRefreshToken).toHaveBeenCalledOnce();
  });

  it('revokes the rest of a family when an already rotated token is reused', async () => {
    const { service, sessionRepository } = setup({
      revocadoEn: new Date(Date.now() - 1_000),
    });

    await expect(service.refresh('old-token')).rejects.toThrow(
      'Se detectó reutilización del refresh token',
    );
    expect(sessionRepository.update).toHaveBeenCalledWith(
      { familiaId: 'family-1', revocadoEn: expect.anything() },
      { revocadoEn: expect.any(Date) },
    );
  });
});
