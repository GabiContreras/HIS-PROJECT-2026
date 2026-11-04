import { RolUsuario, Usuario } from '../../../entities/usuario.entity.js';
import { TokenService } from './token.service.js';

describe('TokenService', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = '0123456789abcdef0123456789abcdef';
    delete process.env.ACCESS_TOKEN_TTL_SECONDS;
    delete process.env.JWT_EXPIRES_IN;
  });

  it('issues verifiable short-lived access tokens', () => {
    const service = new TokenService();
    const account = {
      id: 'user-1',
      rol: RolUsuario.MEDICO,
      esSuperadmin: false,
    } as Usuario;

    const claims = service.verifyAccessToken(
      service.issueAccessToken(account, 'session-1'),
    );

    expect(claims).toMatchObject({
      sub: 'user-1',
      sid: 'session-1',
      rol: RolUsuario.MEDICO,
      superadmin: false,
    });
    expect(claims.exp - claims.iat).toBe(900);
  });

  it('rejects tampered tokens', () => {
    const service = new TokenService();
    const account = {
      id: 'user-1',
      rol: RolUsuario.MEDICO,
      esSuperadmin: false,
    } as Usuario;
    const token = service.issueAccessToken(account, 'session-1');
    const tampered = `${token.slice(0, -1)}${token.endsWith('x') ? 'y' : 'x'}`;

    expect(() => service.verifyAccessToken(tampered)).toThrow();
  });

  it('supports JWT_EXPIRES_IN duration strings such as 5m', () => {
    process.env.JWT_EXPIRES_IN = '5m';
    const service = new TokenService();

    expect(service.accessTokenTtlSeconds).toBe(300);
  });
});
