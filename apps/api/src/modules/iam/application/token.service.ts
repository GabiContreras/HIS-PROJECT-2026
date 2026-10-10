import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { RolUsuario, Usuario } from '../../../entities/usuario.entity.js';

export interface AccessTokenClaims {
  sub: string;
  sid: string;
  rol: RolUsuario;
  superadmin: boolean;
  iat: number;
  exp: number;
}

function parseTokenLifetime(value: string | undefined): number {
  if (!value) return 900;
  const match = /^(\d+)(s|m|h|d)?$/i.exec(value.trim());
  if (!match) return Number.NaN;

  const amount = Number(match[1]);
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
  };
  const multiplier = multipliers[(match[2] ?? 's').toLowerCase()];
  return multiplier === undefined ? Number.NaN : amount * multiplier;
}

@Injectable()
export class TokenService {
  private readonly secret: string;
  readonly accessTokenTtlSeconds: number;
  readonly refreshTokenTtlSeconds = Number(
    process.env.REFRESH_TOKEN_TTL_SECONDS ?? 604800,
  );

  constructor() {
    const secret = process.env.JWT_SECRET;
    if (!secret || Buffer.byteLength(secret) < 32) {
      throw new Error('JWT_SECRET debe configurarse con al menos 32 bytes.');
    }
    this.secret = secret;
    this.accessTokenTtlSeconds = parseTokenLifetime(
      process.env.JWT_EXPIRES_IN ?? process.env.ACCESS_TOKEN_TTL_SECONDS,
    );
    const configuredTtls: [string, number][] = [
      ['JWT_EXPIRES_IN', this.accessTokenTtlSeconds],
      ['REFRESH_TOKEN_TTL_SECONDS', this.refreshTokenTtlSeconds],
    ];
    for (const [name, value] of configuredTtls) {
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${name} debe ser un entero positivo.`);
      }
    }
    if (this.accessTokenTtlSeconds > 900) {
      throw new Error('JWT_EXPIRES_IN no puede superar 15 minutos.');
    }
    if (this.refreshTokenTtlSeconds > 30 * 24 * 60 * 60) {
      throw new Error('REFRESH_TOKEN_TTL_SECONDS no puede superar 30 días.');
    }
  }

  issueAccessToken(usuario: Usuario, sessionId: string): string {
    const now = Math.floor(Date.now() / 1000);
    const claims: AccessTokenClaims = {
      sub: usuario.id,
      sid: sessionId,
      rol: usuario.rol,
      superadmin: usuario.esSuperadmin,
      iat: now,
      exp: now + this.accessTokenTtlSeconds,
    };
    const header = this.encode({ alg: 'HS256', typ: 'JWT' });
    const payload = this.encode(claims);
    const signingInput = `${header}.${payload}`;
    return `${signingInput}.${this.sign(signingInput)}`;
  }

  verifyAccessToken(token: string): AccessTokenClaims {
    const parts = token.split('.');
    if (parts.length !== 3) throw new UnauthorizedException('Token inválido.');

    const signingInput = `${parts[0]}.${parts[1]}`;
    const expected = Buffer.from(this.sign(signingInput));
    const actual = Buffer.from(parts[2]);
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      throw new UnauthorizedException('Token inválido.');
    }

    let header: unknown;
    let claims: unknown;
    try {
      header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Token inválido.');
    }

    if (
      typeof header !== 'object' ||
      header === null ||
      !('alg' in header) ||
      header.alg !== 'HS256' ||
      typeof claims !== 'object' ||
      claims === null
    ) {
      throw new UnauthorizedException('Token inválido.');
    }

    const value = claims as Partial<AccessTokenClaims>;
    if (
      typeof value.sub !== 'string' ||
      typeof value.sid !== 'string' ||
      !Object.values(RolUsuario).includes(value.rol as RolUsuario) ||
      typeof value.superadmin !== 'boolean' ||
      typeof value.exp !== 'number' ||
      value.exp <= Math.floor(Date.now() / 1000)
    ) {
      throw new UnauthorizedException('Token inválido o vencido.');
    }
    return value as AccessTokenClaims;
  }

  createRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  hashOpaqueValue(value: string): string {
    return this.sign(value);
  }

  private encode(value: object): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }

  private sign(value: string): string {
    return createHmac('sha256', this.secret).update(value).digest('base64url');
  }
}
