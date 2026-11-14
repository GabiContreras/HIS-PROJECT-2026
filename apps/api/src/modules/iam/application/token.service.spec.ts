import { UnauthorizedException } from '@nestjs/common';
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

describe('TokenService — configuración y validación de tokens', () => {
  const SECRET = 'un-secreto-de-prueba-de-al-menos-32-bytes!!';
  const original = { ...process.env };

  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
    delete process.env.JWT_EXPIRES_IN;
    delete process.env.ACCESS_TOKEN_TTL_SECONDS;
    delete process.env.REFRESH_TOKEN_TTL_SECONDS;
  });

  afterEach(() => {
    process.env = { ...original };
    vi.useRealTimers();
  });

  const usuario = { id: 'u-1', rol: RolUsuario.MEDICO, esSuperadmin: false } as Usuario;
  const firmar = (service: TokenService, header: object, claims: object) => {
    const encode = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');
    const input = `${encode(header)}.${encode(claims)}`;
    return `${input}.${service.hashOpaqueValue(input)}`;
  };

  it.each([
    ['falta', undefined],
    ['tiene menos de 32 bytes', 'corto'],
  ])('no arranca si JWT_SECRET %s', (_caso, secret) => {
    if (secret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = secret;
    expect(() => new TokenService()).toThrow('JWT_SECRET debe configurarse con al menos 32 bytes.');
  });

  it('usa 15 minutos de access token y 7 días de refresh por defecto', () => {
    const service = new TokenService();
    expect(service.accessTokenTtlSeconds).toBe(900);
    expect(service.refreshTokenTtlSeconds).toBe(604800);
  });

  it.each([
    ['30', 30],
    ['45s', 45],
    ['10m', 600],
  ])('interpreta JWT_EXPIRES_IN=%s', (valor, segundos) => {
    process.env.JWT_EXPIRES_IN = valor;
    expect(new TokenService().accessTokenTtlSeconds).toBe(segundos);
  });

  it.each([
    ['JWT_EXPIRES_IN', 'abc', 'JWT_EXPIRES_IN debe ser un entero positivo.'],
    ['JWT_EXPIRES_IN', '0', 'JWT_EXPIRES_IN debe ser un entero positivo.'],
    ['JWT_EXPIRES_IN', '1h', 'JWT_EXPIRES_IN no puede superar 15 minutos.'],
    ['JWT_EXPIRES_IN', '1d', 'JWT_EXPIRES_IN no puede superar 15 minutos.'],
    ['REFRESH_TOKEN_TTL_SECONDS', 'abc', 'REFRESH_TOKEN_TTL_SECONDS debe ser un entero positivo.'],
    ['REFRESH_TOKEN_TTL_SECONDS', '-5', 'REFRESH_TOKEN_TTL_SECONDS debe ser un entero positivo.'],
    ['REFRESH_TOKEN_TTL_SECONDS', String(31 * 24 * 60 * 60), 'REFRESH_TOKEN_TTL_SECONDS no puede superar 30 días.'],
  ])('no arranca con %s=%s', (variable, valor, mensaje) => {
    process.env[variable] = valor;
    expect(() => new TokenService()).toThrow(mensaje);
  });

  it('rechaza un token vencido', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T10:00:00.000Z'));
    const service = new TokenService();
    const token = service.issueAccessToken(usuario, 's-1');
    expect(service.verifyAccessToken(token).sub).toBe('u-1');

    vi.setSystemTime(new Date('2030-01-01T10:15:01.000Z'));
    expect(() => service.verifyAccessToken(token)).toThrow(UnauthorizedException);
  });

  it('rechaza un token que no tiene tres partes', () => {
    const service = new TokenService();
    expect(() => service.verifyAccessToken('solo.dos')).toThrow(UnauthorizedException);
    expect(() => service.verifyAccessToken('')).toThrow(UnauthorizedException);
  });

  it('rechaza un token firmado con otro secreto', () => {
    const token = new TokenService().issueAccessToken(usuario, 's-1');
    process.env.JWT_SECRET = 'otro-secreto-distinto-de-al-menos-32-bytes';
    expect(() => new TokenService().verifyAccessToken(token)).toThrow(UnauthorizedException);
  });

  it('rechaza un token bien firmado cuyo contenido no es JSON', () => {
    const service = new TokenService();
    const input = `${Buffer.from('no-json').toString('base64url')}.${Buffer.from('tampoco').toString('base64url')}`;
    expect(() => service.verifyAccessToken(`${input}.${service.hashOpaqueValue(input)}`)).toThrow(UnauthorizedException);
  });

  it('rechaza un algoritmo distinto de HS256 aunque la firma sea válida', () => {
    const service = new TokenService();
    const claims = { sub: 'u-1', sid: 's-1', rol: RolUsuario.MEDICO, superadmin: false, exp: Math.floor(Date.now() / 1000) + 60 };
    expect(() => service.verifyAccessToken(firmar(service, { alg: 'none' }, claims))).toThrow(UnauthorizedException);
    expect(service.verifyAccessToken(firmar(service, { alg: 'HS256' }, claims)).sub).toBe('u-1');
  });

  it.each([
    ['sin sub', { sub: undefined }],
    ['sin sid', { sid: undefined }],
    ['con un rol inexistente', { rol: 'LIMPIEZA' }],
    ['con superadmin que no es booleano', { superadmin: 'true' }],
    ['sin exp', { exp: undefined }],
  ])('rechaza claims %s', (_caso, over) => {
    const service = new TokenService();
    const claims = { sub: 'u-1', sid: 's-1', rol: RolUsuario.MEDICO, superadmin: false, exp: Math.floor(Date.now() / 1000) + 60, ...over };
    expect(() => service.verifyAccessToken(firmar(service, { alg: 'HS256' }, claims))).toThrow(UnauthorizedException);
  });

  it('genera refresh tokens aleatorios y los guarda como hash determinístico', () => {
    const service = new TokenService();
    const a = service.createRefreshToken();
    const b = service.createRefreshToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(64);
    expect(service.hashOpaqueValue(a)).toBe(service.hashOpaqueValue(a));
    expect(service.hashOpaqueValue(a)).not.toBe(a);
  });
});
