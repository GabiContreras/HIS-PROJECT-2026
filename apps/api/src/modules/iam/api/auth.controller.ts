import {
  Body,
  ForbiddenException,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from '../application/auth.service.js';
import type { SessionIdentity } from '../application/auth.service.js';
import { TokenService } from '../application/token.service.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { EmailDto } from './dto/email.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { AuthGuard } from './auth.guard.js';
import { CurrentIdentity } from './auth.decorator.js';

const REFRESH_COOKIE = 'his_refresh';

@Controller('auth')
@ApiTags('Autenticación')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertTrustedOrigin(request);
    const result = await this.auth.login(dto.email, dto.password);
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken, account: result.account };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertTrustedOrigin(request);
    const refreshToken = this.readRefreshCookie(request);
    if (!refreshToken) {
      throw new UnauthorizedException(
        'No hay una sesión de actualización activa.',
      );
    }
    const result = await this.auth.refresh(refreshToken);
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken, account: result.account };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    this.assertTrustedOrigin(request);
    await this.auth.logout(this.readRefreshCookie(request));
    this.clearRefreshCookie(response);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  me(@CurrentIdentity() identity: SessionIdentity) {
    return this.auth.publicAccount(identity.accountId);
  }

  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() dto: EmailDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  changePassword(
    @CurrentIdentity() identity: SessionIdentity,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(
      identity,
      dto.passwordActual,
      dto.passwordNueva,
    );
  }

  private setRefreshCookie(response: Response, value: string): void {
    const maxAge = this.tokens.refreshTokenTtlSeconds;
    const sameSite = process.env.NODE_ENV === 'production' ? 'None' : 'Strict';
    response.setHeader(
      'Set-Cookie',
      `${REFRESH_COOKIE}=${value}; HttpOnly; Path=/auth; SameSite=${sameSite}; Max-Age=${maxAge}${this.secureCookieAttribute()}`,
    );
  }

  private clearRefreshCookie(response: Response): void {
    const sameSite = process.env.NODE_ENV === 'production' ? 'None' : 'Strict';
    response.setHeader(
      'Set-Cookie',
      `${REFRESH_COOKIE}=; HttpOnly; Path=/auth; SameSite=${sameSite}; Max-Age=0${this.secureCookieAttribute()}`,
    );
  }

  private secureCookieAttribute(): string {
    return process.env.NODE_ENV === 'production' ? '; Secure' : '';
  }

  private readRefreshCookie(request: Request): string | undefined {
    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) return undefined;
    const cookie = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${REFRESH_COOKIE}=`));
    return cookie?.slice(REFRESH_COOKIE.length + 1);
  }

  private assertTrustedOrigin(request: Request): void {
    const origin = request.headers.origin;
    const host = request.get('host');
    const apiOrigin = host ? `${request.protocol}://${host}` : undefined;
    const allowedOrigins = (
      process.env.FRONTEND_ORIGINS ?? 'http://localhost:5173'
    )
      .split(',')
      .map((value) => value.trim());
    if (
      !origin ||
      (!allowedOrigins.includes(origin) && origin !== apiOrigin)
    ) {
      throw new ForbiddenException(
        'Solicitud de autenticación desde un origen no permitido.',
      );
    }
  }
}
