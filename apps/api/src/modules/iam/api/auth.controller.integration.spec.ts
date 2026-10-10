import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthService } from '../application/auth.service.js';
import { TokenService } from '../application/token.service.js';
import { AuthGuard } from './auth.guard.js';
import { AuthController } from './auth.controller.js';

describe('AuthController integration', () => {
  let app: INestApplication;
  const authService = {
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    resetPassword: vi.fn(),
  };
  const tokenService = { refreshTokenTtlSeconds: 604800 };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: TokenService, useValue: tokenService },
        { provide: AuthGuard, useValue: { canActivate: () => true } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns an access token and sets the refresh token only in an HttpOnly cookie', async () => {
    authService.login.mockResolvedValue({
      accessToken: 'access.jwt.value',
      refreshToken: 'opaque-refresh-value',
      account: { id: 'user-1', rol: 'MEDICO', estado: 'ACTIVO' },
    });

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'doctor@example.com', password: 'CorrectHorse4' })
      .expect(200);

    expect(response.body).toEqual({
      accessToken: 'access.jwt.value',
      account: { id: 'user-1', rol: 'MEDICO', estado: 'ACTIVO' },
    });
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.headers['set-cookie'][0]).toContain('SameSite=Strict');
    expect(response.headers['set-cookie'][0]).toContain('opaque-refresh-value');
  });

  it('rotates refresh cookies only for trusted browser origins', async () => {
    authService.refresh.mockResolvedValue({
      accessToken: 'next.access.jwt',
      refreshToken: 'next-refresh-value',
      account: { id: 'user-1' },
    });

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', 'his_refresh=old-refresh-value')
      .expect(200)
      .expect(({ headers, body }) => {
        expect(body.accessToken).toBe('next.access.jwt');
        expect(headers['set-cookie'][0]).toContain('next-refresh-value');
      });
    expect(authService.refresh).toHaveBeenCalledWith('old-refresh-value');

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Origin', 'https://attacker.example')
      .set('Cookie', 'his_refresh=stolen')
      .expect(403);
    expect(authService.refresh).toHaveBeenCalledTimes(1);
  });

  it('accepts password reset without an email verification code', async () => {
    authService.resetPassword.mockResolvedValue({
      message: 'La contraseña fue restablecida.',
    });

    const response = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({
        email: 'doctor@example.com',
        password: 'NewSecurePassword4',
      })
      .expect(200);

    expect(response.body).toEqual({
      message: 'La contraseña fue restablecida.',
    });
    expect(authService.resetPassword).toHaveBeenCalledWith({
      email: 'doctor@example.com',
      password: 'NewSecurePassword4',
    });
  });
});
